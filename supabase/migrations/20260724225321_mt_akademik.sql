-- ============================================================================
-- WASEELA · MT-03 AKADEMIK (multi-tenant) — port dari Ammu akademik + profiles_rls.
-- absensi, rapor, rekap, prestasi, kenaikan, tes, izin, supervisi.
-- Archetype B: read signedIn, write akademik, delete super — + tenant scope.
-- absensi_santri_sekolah = harian mentah (server-only write). supervisi = role supervisi.
-- ============================================================================

create table public.absensi (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  tanggal    text,
  lembaga    text,
  kelas      text,
  status     text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_santri_idx  on public.absensi (tenant_id, santri_id);
create index absensi_tanggal_idx on public.absensi (tenant_id, tanggal);
create index absensi_lk_idx      on public.absensi (tenant_id, lembaga, kelas);

create table public.absensi_guru (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  guru_id    text,
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_guru_guru_idx    on public.absensi_guru (tenant_id, guru_id);
create index absensi_guru_tanggal_idx on public.absensi_guru (tenant_id, tanggal);

create table public.absensi_shift_guru (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  guru_id    text,
  periode    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_shift_guru_guru_idx on public.absensi_shift_guru (tenant_id, guru_id, periode);

create table public.absensi_kegiatan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.absensi_santri_sekolah (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_santri_sekolah_santri_idx on public.absensi_santri_sekolah (tenant_id, santri_id);

create table public.absensi_santri_sekolah_bulanan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  periode    text,
  sakit      int not null default 0 check (sakit >= 0),
  izin       int not null default 0 check (izin  >= 0),
  alpa       int not null default 0 check (alpa  >= 0),
  hadir      int not null default 0 check (hadir >= 0),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_santri_sekolah_bulanan_idx on public.absensi_santri_sekolah_bulanan (tenant_id, santri_id, periode);

create table public.absensi_santri_ngaji_bulanan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  periode    text,
  sakit      int not null default 0 check (sakit >= 0),
  izin       int not null default 0 check (izin  >= 0),
  alpa       int not null default 0 check (alpa  >= 0),
  hadir      int not null default 0 check (hadir >= 0),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index absensi_santri_ngaji_bulanan_idx on public.absensi_santri_ngaji_bulanan (tenant_id, santri_id, periode);

create table public.rapor_semester (
  tenant_id     uuid not null default public.current_tenant_id() references public.tenants(id),
  id            text not null,
  santri_id     text,
  lembaga       text,
  semester      text,
  tahun_ajaran  text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index rapor_semester_santri_idx  on public.rapor_semester (tenant_id, santri_id);
create index rapor_semester_lembaga_idx on public.rapor_semester (tenant_id, lembaga, semester);

create table public.rekap_diniyah (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index rekap_diniyah_santri_idx on public.rekap_diniyah (tenant_id, santri_id);

create table public.rekap_prestasi (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  lembaga    text,
  kelas      text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index rekap_prestasi_santri_idx  on public.rekap_prestasi (tenant_id, santri_id);
create index rekap_prestasi_lembaga_idx on public.rekap_prestasi (tenant_id, lembaga, kelas);

create table public.riwayat_prestasi (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  periode    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index riwayat_prestasi_santri_idx  on public.riwayat_prestasi (tenant_id, santri_id);
create index riwayat_prestasi_periode_idx on public.riwayat_prestasi (tenant_id, periode);

create table public.notif_prestasi (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index notif_prestasi_santri_idx on public.notif_prestasi (tenant_id, santri_id);

create table public.riwayat_kenaikan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index riwayat_kenaikan_santri_idx on public.riwayat_kenaikan (tenant_id, santri_id);

create table public.tes_kenaikan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  lembaga    text,
  status     text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index tes_kenaikan_santri_idx on public.tes_kenaikan (tenant_id, santri_id);
create index tes_kenaikan_status_idx on public.tes_kenaikan (tenant_id, status);

create table public.izin_guru (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  guru_id    text,
  status     text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index izin_guru_guru_idx on public.izin_guru (tenant_id, guru_id);

create table public.supervisi_catatan (
  tenant_id   uuid not null default public.current_tenant_id() references public.tenants(id),
  id          text not null,
  target_type text,
  target_id   text,
  judul       text,
  catatan     text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index supervisi_catatan_target_idx on public.supervisi_catatan (tenant_id, target_type, target_id);

-- ---- Trigger updated_at + enable RLS (semua tabel akademik) -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'absensi','absensi_guru','absensi_shift_guru','absensi_kegiatan',
    'absensi_santri_sekolah','absensi_santri_sekolah_bulanan','absensi_santri_ngaji_bulanan',
    'rapor_semester','rekap_diniyah','rekap_prestasi','riwayat_prestasi','notif_prestasi',
    'riwayat_kenaikan','tes_kenaikan','izin_guru','supervisi_catatan'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Archetype B (read signedIn, write akademik, delete super) — tenant-scoped.
do $$
declare t text;
begin
  foreach t in array array[
    'absensi','absensi_guru','absensi_shift_guru','absensi_kegiatan',
    'absensi_santri_sekolah_bulanan','absensi_santri_ngaji_bulanan',
    'rapor_semester','rekap_diniyah','rekap_prestasi','riwayat_prestasi','notif_prestasi',
    'riwayat_kenaikan','tes_kenaikan','izin_guru'
  ] loop
    execute format('create policy %I on public.%I for select using (auth.uid() is not null and tenant_id = public.current_tenant_id())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (public.auth_can_akademik() and tenant_id = public.current_tenant_id()) with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (public.auth_is_super() and tenant_id = public.current_tenant_id())', t||'_del', t);
  end loop;
end $$;

-- ABSENSI_SANTRI_SEKOLAH (harian mentah): read signedIn, TANPA create/update
-- (server-only via service_role, mirror rules `create,update: if false`), del super.
create policy assek_sel on public.absensi_santri_sekolah for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy assek_del on public.absensi_santri_sekolah for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- SUPERVISI_CATATAN: read signedIn, write role supervisi, delete super.
create policy supervisi_sel on public.supervisi_catatan for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy supervisi_ins on public.supervisi_catatan for insert
  with check (public.auth_can_supervisi() and tenant_id = public.current_tenant_id());
create policy supervisi_upd on public.supervisi_catatan for update
  using (public.auth_can_supervisi() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_supervisi() and tenant_id = public.current_tenant_id());
create policy supervisi_del on public.supervisi_catatan for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());
