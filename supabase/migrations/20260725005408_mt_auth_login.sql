-- ============================================================================
-- WASEELA · MT-05 AUTH LOGIN (multi-tenant) — port Ammu auth_login + auth_login_source.
--
-- Alur: client kirim username/WA/NIS + source -> resolve_login (anon RPC, SECURITY
-- DEFINER, tenant-scoped via header x-tenant) balikin { source, auth_key, active }
-- (tanpa PII). Client bangun email `<auth_key>@<slug>.waseela.local` -> signIn;
-- belum ada -> signUp (lazy-create). Trigger handle_new_user set peran + tenant.
--
-- BEDA MULTI-TENANT dari Ammu (single-tenant):
--  * _resolve_authkey SCOPE ke tenant (p_tenant / current_tenant_id() dari header).
--  * Email di-NAMESPACE per-tenant: `<auth_key>@<slug>.waseela.local` — cegah bentrok
--    username/NIS antar-lembaga di auth.users.email (unik GLOBAL).
--  * handle_new_user ambil tenant dari SLUG domain email -> set profiles.tenant_id.
--  * admin built-in canonical = 'admin' (BUKAN 'adminmu' — white-label, buang Ammu-ism).
--
-- ⚠️ HARDENING (Fase 7): admin built-in auto-provision (sandi default) berarti siapa pun
--    yang tahu <slug> + sandi default bisa buat super_admin tenant itu. Mitigasi nanti:
--    nonaktifkan auto-provision admin bila tenant sudah punya super_admin nyata.
--
-- APPLY (Dashboard): Auth > Email provider AKTIF + "Confirm email" OFF (domain .local
--    tak terkirim) supaya signUp auto-confirm. Sandi user dipad client 'mu_auth_'+sandi.
-- ============================================================================

-- ---- util normalisasi (IMMUTABLE) ------------------------------------------
create or replace function public._digits(t text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g')
$$;
create or replace function public._norm_key(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9._-]', '', 'g')
$$;

-- ---- resolver inti — TENANT-SCOPED (p_tenant, else current_tenant_id()) -----
create or replace function public._resolve_authkey(
  p_input text, p_source text default null, p_tenant uuid default null)
returns table(source text, ref_id text, role_sistem text, supervisi boolean, active boolean, auth_key text)
language sql stable security definer set search_path = public as $$
  with k as (
    select public._norm_key(p_input) as key,
           public._digits(p_input) as dig,
           nullif(lower(coalesce(p_source, '')), '') as src,
           coalesce(p_tenant, public.current_tenant_id()) as tid
  )
  select * from (
    -- admin built-in -> super_admin (ikut jalur guru/pegawai). Per-tenant via email slug.
    select 'admin'::text, 'admin'::text, 'super_admin'::text, true, true, 'admin'::text
    from k
    where k.key = 'admin' and (k.src is null or k.src = 'guru')
    union all
    -- guru: cocok via username ATAU WA (DALAM tenant); kanonik = username else digits(wa)
    select 'guru', g.id, g.role_sistem,
           (lower(coalesce(g.jabatan, '')) ~ 'direktur|supervisor'
            or lower(coalesce(g.jabatan_tambahan, '')) ~ 'direktur|supervisor'),
           (g.status is distinct from 'Tidak Aktif'),
           coalesce(nullif(public._norm_key(g.username), ''), public._digits(g.wa))
    from public.guru g, k
    where g.tenant_id = k.tid
      and (k.src is null or k.src = 'guru')
      and (nullif(public._norm_key(g.username), '') = k.key
           or (k.dig <> '' and public._digits(g.wa) = k.dig))
    union all
    -- santri: cocok via NIS ATAU WA wali (DALAM tenant); kanonik = NIS else digits(wa)
    select 'santri', s.id, 'santri', false,
           coalesce(s.aktif, true),
           coalesce(nullif(public._digits(s.nis), ''), public._digits(s.wa))
    from public.santri s, k
    where s.tenant_id = k.tid
      and (k.src is null or k.src = 'santri')
      and ((k.dig <> '' and public._digits(s.nis) = k.dig)
           or (k.dig <> '' and public._digits(s.wa) = k.dig))
  ) t
  limit 1
$$;

-- ---- resolve_login: RPC anon (tenant dari header x-tenant) ------------------
create or replace function public.resolve_login(p_input text, p_source text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('source', m.source, 'auth_key', m.auth_key, 'active', m.active)
  from public._resolve_authkey(p_input, p_source, public.current_tenant_id()) m
$$;

grant execute on function public.resolve_login(text, text) to anon, authenticated;
grant execute on function public._digits(text) to anon, authenticated;
grant execute on function public._norm_key(text) to anon, authenticated;

-- ---- handle_new_user (REPLACE fondasi): tenant dari SLUG email + mapping peran
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_key    text := split_part(coalesce(new.email, ''), '@', 1);
  v_domain text := split_part(coalesce(new.email, ''), '@', 2);
  v_slug   text := split_part(v_domain, '.', 1);
  v_tenant uuid;
  m record;
  v_rs text;
  v_role text;
begin
  select id into v_tenant from public.tenants where slug = v_slug;
  select * into m from public._resolve_authkey(v_key, null, v_tenant) limit 1;

  if m.source = 'admin' then
    insert into public.profiles (id, tenant_id, login_key, role, role_sistem, supervisi)
    values (new.id, v_tenant, v_key, 'admin', 'super_admin', true)
    on conflict (id) do nothing;
  elsif m.source = 'guru' then
    v_rs := case m.role_sistem
              when 'super_admin' then 'super_admin'
              when 'admin' then 'admin'
              when 'admin_keuangan' then 'admin_keuangan'
              else 'guru' end;
    v_role := case when v_rs in ('admin','admin_keuangan','super_admin') then 'admin' else 'guru' end;
    insert into public.profiles (id, tenant_id, login_key, role, role_sistem, supervisi, guru_id)
    values (new.id, v_tenant, v_key, v_role, v_rs, coalesce(m.supervisi,false), m.ref_id)
    on conflict (id) do nothing;
  elsif m.source = 'santri' then
    insert into public.profiles (id, tenant_id, login_key, role, role_sistem, santri_id)
    values (new.id, v_tenant, v_key, 'santri', 'santri', m.ref_id)
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, tenant_id, login_key, role, role_sistem)
    values (new.id, v_tenant, v_key, 'santri', 'santri')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
