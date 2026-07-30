-- ============================================================================
-- WASEELA · MT-08 FITUR PTPT — tes_glondongan + ceremonial_ptpt (multi-tenant).
-- Base Archetype-B (read signedIn, write akademik, delete super) — + tenant scope.
--
-- ⚠️ RLS LOCK PTPT DITUNDA (follow-up terpisah): Ammu mengunci glondongan/ceremonial
--    lebih ketat (PJ PTPT / koordinator glondongan / pengampu santri) via 5 helper
--    (auth_is_pj_lembaga, auth_is_koordinator_glondongan, auth_is_pengampu_santri, dst)
--    yang MEMBACA guru/master/santri → di multi-tenant WAJIB di-scope tenant (join
--    guru/master/santri lintas-tenant = bug). Security-critical → dikerjakan tersendiri
--    + test. Ammu sendiri ship base dulu (20260701/0719_130000) lalu lock (0719_1401xx).
--    Aman ditunda: belum ada data/ user produksi, view belum diwire.
-- ============================================================================

-- ---- tes_glondongan (KHUSUS PTPT — muroja'ah kumulatif) ---------------------
create table if not exists public.tes_glondongan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  ajuan_id   text,
  santri_id  text,
  tipe       text,
  kelas_asal int,
  status     text,
  penguji_id text,
  periode    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index if not exists tes_glondongan_santri_idx  on public.tes_glondongan (tenant_id, santri_id);
create index if not exists tes_glondongan_ajuan_idx   on public.tes_glondongan (tenant_id, ajuan_id);
create index if not exists tes_glondongan_penguji_idx on public.tes_glondongan (tenant_id, penguji_id);
create index if not exists tes_glondongan_periode_idx on public.tes_glondongan (tenant_id, periode);
create index if not exists tes_glondongan_queue_idx   on public.tes_glondongan (tenant_id, kelas_asal, status);
drop trigger if exists set_updated_at on public.tes_glondongan;
create trigger set_updated_at before update on public.tes_glondongan for each row execute function public.set_updated_at();
grant all on public.tes_glondongan to anon, authenticated, service_role;

alter table public.tes_glondongan enable row level security;
create policy tes_glondongan_sel on public.tes_glondongan for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy tes_glondongan_ins on public.tes_glondongan for insert
  with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id());
create policy tes_glondongan_upd on public.tes_glondongan for update
  using (public.auth_can_akademik() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id());
create policy tes_glondongan_del on public.tes_glondongan for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- ---- ceremonial_ptpt (sesi ceremonial kenaikan PTPT) -----------------------
create table if not exists public.ceremonial_ptpt (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  tanggal    text,
  jam_mulai  text,
  status     text,
  periode    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index if not exists ceremonial_ptpt_tanggal_idx on public.ceremonial_ptpt (tenant_id, tanggal);
create index if not exists ceremonial_ptpt_periode_idx on public.ceremonial_ptpt (tenant_id, periode);
create index if not exists ceremonial_ptpt_status_idx  on public.ceremonial_ptpt (tenant_id, status);
drop trigger if exists set_updated_at on public.ceremonial_ptpt;
create trigger set_updated_at before update on public.ceremonial_ptpt for each row execute function public.set_updated_at();
grant all on public.ceremonial_ptpt to anon, authenticated, service_role;

alter table public.ceremonial_ptpt enable row level security;
create policy ceremonial_ptpt_sel on public.ceremonial_ptpt for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy ceremonial_ptpt_ins on public.ceremonial_ptpt for insert
  with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id());
create policy ceremonial_ptpt_upd on public.ceremonial_ptpt for update
  using (public.auth_can_akademik() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id());
create policy ceremonial_ptpt_del on public.ceremonial_ptpt for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- ---- Realtime (idempoten) --------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tes_glondongan','ceremonial_ptpt'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
