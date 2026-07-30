-- ============================================================================
-- WASEELA · MT-09 RLS LOCK PTPT (multi-tenant) — port Ammu rls_helpers_ptpt +
-- rls_tes_glondongan_lock + rls_ceremonial_lock + auth_is_pengampu.
--
-- Kunci hak tulis glondongan/ceremonial ke PJ PTPT / koordinator glondongan /
-- pengampu santri (bukan sekadar "semua guru"). Baca = staf saja (santri/wali tertolak).
--
-- ⚠️ FIX MULTI-TENANT (kritis): tiap helper yang membaca guru/master/santri di-SCOPE
--    tenant — tanpa itu `join guru on g.id=p.guru_id` / `master where key='lembaga'` /
--    `santri where s.id=...` kena baris tenant LAIN. Policy lock JUGA tetap
--    `AND tenant_id = current_tenant_id()` (mengganti base yang sudah tenant-scoped).
-- ============================================================================

-- ---- Helper identitas guru (login) -----------------------------------------
create or replace function public.auth_guru_id()
returns text language sql stable security definer set search_path = public as $$
  select nullif(btrim(p.guru_id), '') from public.profiles p where p.id = auth.uid() limit 1
$$;

create or replace function public.auth_guru_nama()
returns text language sql stable security definer set search_path = public as $$
  select nullif(btrim(g.nama), '')
  from public.profiles p
  join public.guru g on g.id = p.guru_id and g.tenant_id = p.tenant_id   -- FIX tenant
  where p.id = auth.uid()
  limit 1
$$;

-- Guru login = pengampu santri (cocok NAMA di data pengampu). Baca hanya jsonb + nama.
create or replace function public.auth_is_pengampu(p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    lower(public.auth_guru_nama()) in (
      lower(nullif(btrim(p_data->>'guru_pagi'), '')),
      lower(nullif(btrim(p_data->>'guru_sore'), '')),
      lower(nullif(btrim(p_data->>'guru'), ''))
    )
    or exists (
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(p_data->'guru_sekolah') = 'array' then p_data->'guru_sekolah' else '[]'::jsonb end
      ) as gs(nama)
      where btrim(gs.nama) <> '' and lower(btrim(gs.nama)) = lower(public.auth_guru_nama())
    ), false)
$$;

-- Guru login bertugas di lembaga ini? (cocok lembaga ATAU lembaga_sekolah)
create or replace function public.auth_guru_di_lembaga(p_lembaga text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.guru g on g.id = p.guru_id and g.tenant_id = p.tenant_id   -- FIX tenant
    where p.id = auth.uid()
      and upper(btrim(coalesce(p_lembaga, ''))) <> ''
      and upper(btrim(coalesce(p_lembaga, ''))) in (
        upper(btrim(coalesce(g.lembaga, ''))),
        upper(btrim(coalesce(g.lembaga_sekolah, '')))
      )
  )
$$;

-- Guru login = kepala/PJ/pengasuh lembaga ini? (lembaga SAJA, bukan lembaga_sekolah)
create or replace function public.auth_is_pj_lembaga(p_lembaga text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.guru g on g.id = p.guru_id and g.tenant_id = p.tenant_id   -- FIX tenant
    where p.id = auth.uid()
      and lower(coalesce(g.jabatan, '') || ' ' || coalesce(g.jabatan_tambahan, ''))
          ~ '(^|\s)(kepala|pj|pengasuh)(\s|$)'
      and upper(btrim(coalesce(g.lembaga, ''))) = upper(btrim(coalesce(p_lembaga, '')))
  )
$$;

-- Guru login = koordinator glondongan PTPT? (master key='lembaga' -> list -> PTPT ->
-- koordinator_glondongan{kategori:[guruId]}). master di-scope tenant.
create or replace function public.auth_is_koordinator_glondongan(p_kategori text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.auth_guru_id() is not null and exists (
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
      and m.tenant_id = public.current_tenant_id()                        -- FIX tenant
      and upper(btrim(coalesce(l.obj->>'lembaga', l.obj->>'nama', ''))) = 'PTPT'
      and (p_kategori is null or k.kategori = p_kategori)
      and btrim(g.guru_id) = public.auth_guru_id()
  )
$$;

-- Guru login = pengampu santri ini? (santri di-scope tenant)
create or replace function public.auth_is_pengampu_santri(p_santri_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.santri s
    where s.id = p_santri_id
      and s.tenant_id = public.current_tenant_id()                        -- FIX tenant
      and public.auth_is_pengampu(s.data)
  )
$$;

-- ---- santri: guru pengampu boleh update santri ampuannya (permissive, OR) ----
drop policy if exists santri_upd_pengampu on public.santri;
create policy santri_upd_pengampu on public.santri for update
  using (public.auth_is_pengampu(data) and tenant_id = public.current_tenant_id())
  with check (public.auth_is_pengampu(data) and tenant_id = public.current_tenant_id());

-- ---- LOCK tes_glondongan ----------------------------------------------------
drop policy if exists tes_glondongan_sel on public.tes_glondongan;
create policy tes_glondongan_sel on public.tes_glondongan for select
  using (public.auth_is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists tes_glondongan_ins on public.tes_glondongan;
create policy tes_glondongan_ins on public.tes_glondongan for insert
  with check (
    tenant_id = public.current_tenant_id() and (
      public.auth_can_manage()
      or (coalesce(btrim(status), '') <> 'selesai'
        and (public.auth_is_pj_lembaga('PTPT')
          or public.auth_is_koordinator_glondongan()
          or public.auth_is_pengampu_santri(santri_id)))
    )
  );

drop policy if exists tes_glondongan_upd on public.tes_glondongan;
create policy tes_glondongan_upd on public.tes_glondongan for update
  using (
    tenant_id = public.current_tenant_id() and (
      public.auth_is_super() or public.auth_is_pj_lembaga('PTPT')
      or public.auth_is_koordinator_glondongan(
           case when data->>'mukim' in ('true','t','1') then 'mahad' else 'nonmahad' end)
      or (nullif(btrim(penguji_id), '') is not null
          and btrim(penguji_id) = public.auth_guru_id()
          and public.auth_guru_di_lembaga('PTPT'))
    )
  ) with check (
    tenant_id = public.current_tenant_id() and (
      public.auth_is_super() or public.auth_is_pj_lembaga('PTPT')
      or public.auth_is_koordinator_glondongan(
           case when data->>'mukim' in ('true','t','1') then 'mahad' else 'nonmahad' end)
      or (nullif(btrim(penguji_id), '') is not null
          and btrim(penguji_id) = public.auth_guru_id()
          and public.auth_guru_di_lembaga('PTPT'))
    )
  );
-- tes_glondongan_del (auth_is_super + tenant) tetap dari base.

-- ---- LOCK ceremonial_ptpt ---------------------------------------------------
drop policy if exists ceremonial_ptpt_sel on public.ceremonial_ptpt;
create policy ceremonial_ptpt_sel on public.ceremonial_ptpt for select
  using (public.auth_is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists ceremonial_ptpt_ins on public.ceremonial_ptpt;
create policy ceremonial_ptpt_ins on public.ceremonial_ptpt for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (public.auth_is_super() or public.auth_is_pj_lembaga('PTPT')
         or public.auth_is_koordinator_glondongan())
  );

drop policy if exists ceremonial_ptpt_upd on public.ceremonial_ptpt;
create policy ceremonial_ptpt_upd on public.ceremonial_ptpt for update
  using (
    tenant_id = public.current_tenant_id()
    and (public.auth_is_super() or public.auth_is_pj_lembaga('PTPT')
         or public.auth_is_koordinator_glondongan())
  ) with check (
    tenant_id = public.current_tenant_id()
    and (public.auth_is_super() or public.auth_is_pj_lembaga('PTPT')
         or public.auth_is_koordinator_glondongan())
  );
-- ceremonial_ptpt_del (auth_is_super + tenant) tetap dari base.
