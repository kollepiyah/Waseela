-- ============================================================================
-- WASEELA · MT-11 FASE 7 — RELOKASI HELPER RLS KE SCHEMA `private` (tuntas 0028/0029)
--
-- Masalah: 16 helper peran/tenant SECURITY DEFINER ada di schema `public` -> ter-expose
--   sbg RPC `/rest/v1/rpc/<helper>` (advisor 0028/0029). Tak bisa sekadar REVOKE execute
--   dari authenticated: helper dipakai DI DALAM policy + DEFAULT kolom -> query jadi
--   'permission denied'.
--
-- Solusi (diverifikasi via probe): PINDAHKAN helper ke schema `private` yang TIDAK
--   di-expose PostgREST. Referensi policy/default/trigger ke fungsi disimpan by-OID,
--   jadi `ALTER FUNCTION ... SET SCHEMA private` -> otomatis ikut (tak perlu sentuh 74
--   policy / default 46 tabel). Yang WAJIB ditulis-ulang HANYA body fungsi yg memanggil
--   helper lain secara qualified `public.<x>` (jadi `private.<x>`).
--
--   GRANT USAGE schema private + EXECUTE ke anon/authenticated TETAP diberikan supaya
--   evaluasi policy bisa memanggil helper. Ini AMAN: tanpa PostgREST meng-expose `private`,
--   tak ada endpoint RPC -> advisor 0028/0029 bersih untuk fungsi-fungsi ini.
--
--   TETAP di `public` (sengaja): resolve_login (RPC login dipanggil anon), _resolve_authkey
--   + handle_new_user + sync_guru_profile_role (sudah di-REVOKE di migrasi 20260730000000),
--   _digits/_norm_key/set_updated_at (bukan definer, tak sensitif).
-- ============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---- 1) Pindahkan 16 helper definer ke `private` (deps ikut by-OID) ----------
alter function public.auth_role_sistem()                         set schema private;
alter function public.auth_is_super()                            set schema private;
alter function public.auth_can_manage()                          set schema private;
alter function public.auth_can_keuangan()                        set schema private;
alter function public.auth_can_akademik()                        set schema private;
alter function public.auth_is_staff()                            set schema private;
alter function public.auth_can_supervisi()                       set schema private;
alter function public.auth_can_pengaduan()                       set schema private;
alter function public.current_tenant_id()                        set schema private;
alter function public.auth_guru_id()                             set schema private;
alter function public.auth_guru_nama()                           set schema private;
alter function public.auth_is_pengampu(jsonb)                    set schema private;
alter function public.auth_guru_di_lembaga(text)                 set schema private;
alter function public.auth_is_pj_lembaga(text)                   set schema private;
alter function public.auth_is_koordinator_glondongan(text)       set schema private;
alter function public.auth_is_pengampu_santri(text)              set schema private;

-- ---- 2) Tulis-ulang body yg memanggil helper lain: public.<x> -> private.<x> --
-- (fungsi tanpa panggilan helper — auth_role_sistem, current_tenant_id, auth_guru_id,
--  auth_guru_nama, auth_guru_di_lembaga, auth_is_pj_lembaga — TAK diubah: body hanya
--  merujuk public.profiles/guru/master/santri yang tetap di public.)

create or replace function private.auth_is_super()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() = 'super_admin', false)
$$;

create or replace function private.auth_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() in ('super_admin','admin'), false)
$$;

create or replace function private.auth_can_keuangan()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() in ('super_admin','admin_keuangan'), false)
$$;

create or replace function private.auth_can_akademik()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() in ('super_admin','admin','guru'), false)
$$;

create or replace function private.auth_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() in ('super_admin','admin','admin_keuangan','guru'), false)
$$;

create or replace function private.auth_can_supervisi()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_is_super()
    or (select supervisi from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.auth_can_pengaduan()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_can_manage()
    or (select pengaduan from public.profiles where id = auth.uid()), false)
$$;

create or replace function private.auth_is_pengampu(p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    lower(private.auth_guru_nama()) in (
      lower(nullif(btrim(p_data->>'guru_pagi'), '')),
      lower(nullif(btrim(p_data->>'guru_sore'), '')),
      lower(nullif(btrim(p_data->>'guru'), ''))
    )
    or exists (
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(p_data->'guru_sekolah') = 'array' then p_data->'guru_sekolah' else '[]'::jsonb end
      ) as gs(nama)
      where btrim(gs.nama) <> '' and lower(btrim(gs.nama)) = lower(private.auth_guru_nama())
    ), false)
$$;

create or replace function private.auth_is_koordinator_glondongan(p_kategori text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select private.auth_guru_id() is not null and exists (
    select 1 from public.master m
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(m.value->'list') = 'array' then m.value->'list' else '[]'::jsonb end
    ) as l(obj)
    cross join lateral jsonb_each(
      case when jsonb_typeof(l.obj->'koordinator_glondongan') = 'object'
           then l.obj->'koordinator_glondongan' else '{}'::jsonb end
    ) as k(kategori, ids)
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(k.ids) = 'array' then k.ids else '[]'::jsonb end
    ) as g(guru_id)
    where m.key = 'lembaga'
      and m.tenant_id = private.current_tenant_id()
      and upper(btrim(coalesce(l.obj->>'lembaga', l.obj->>'nama', ''))) = 'PTPT'
      and (p_kategori is null or k.kategori = p_kategori)
      and btrim(g.guru_id) = private.auth_guru_id()
  )
$$;

create or replace function private.auth_is_pengampu_santri(p_santri_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.santri s
    where s.id = p_santri_id
      and s.tenant_id = private.current_tenant_id()
      and private.auth_is_pengampu(s.data)
  )
$$;

-- ---- 3) Fungsi yg TETAP di public tapi memanggil current_tenant_id (dipindah) -
create or replace function public._resolve_authkey(
  p_input text, p_source text default null, p_tenant uuid default null)
returns table(source text, ref_id text, role_sistem text, supervisi boolean, active boolean, auth_key text)
language sql stable security definer set search_path = public as $$
  with k as (
    select public._norm_key(p_input) as key,
           public._digits(p_input) as dig,
           nullif(lower(coalesce(p_source, '')), '') as src,
           coalesce(p_tenant, private.current_tenant_id()) as tid
  )
  select * from (
    select 'admin'::text, 'admin'::text, 'super_admin'::text, true, true, 'admin'::text
    from k
    where k.key = 'admin' and (k.src is null or k.src = 'guru')
    union all
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

create or replace function public.resolve_login(p_input text, p_source text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('source', m.source, 'auth_key', m.auth_key, 'active', m.active)
  from public._resolve_authkey(p_input, p_source, private.current_tenant_id()) m
$$;

-- ---- 4) Pertahankan postur grant (create-or-replace bisa reset ACL) ----------
grant execute on all functions in schema private to anon, authenticated, service_role;
-- _resolve_authkey tetap TERTUTUP dari permukaan RPC (dipanggil hanya via definer):
revoke execute on function public._resolve_authkey(text, text, uuid) from public, anon, authenticated;
-- resolve_login WAJIB tetap bisa dipanggil anon (login):
grant execute on function public.resolve_login(text, text) to anon, authenticated;
