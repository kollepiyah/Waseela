-- ============================================================================
-- WASEELA · MT-02 KEUANGAN (multi-tenant) — port dari Ammu keuangan + profiles_rls.
-- Uang = bigint. Tanggal = text 'YYYY-MM-DD'. Tabungan TERPISAH dari buku induk.
-- Archetype C: read signedIn, write keuangan, delete super — semua + tenant scope.
-- ============================================================================

create table public.keuangan_tagihan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  periode    text,
  kategori   text,
  nominal    bigint not null default 0 check (nominal >= 0),
  terbayar   bigint not null default 0 check (terbayar >= 0),
  status     text,
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_tagihan_santri_idx  on public.keuangan_tagihan (tenant_id, santri_id);
create index keuangan_tagihan_periode_idx on public.keuangan_tagihan (tenant_id, periode, status);

create table public.keuangan_buku_induk (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  tipe       text not null check (tipe in ('masuk','keluar')),
  sumber     text,
  nominal    bigint not null check (nominal > 0),
  tanggal    text,
  keterangan text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_buku_induk_tanggal_idx on public.keuangan_buku_induk (tenant_id, tanggal);
create index keuangan_buku_induk_sumber_idx  on public.keuangan_buku_induk (tenant_id, sumber);

create table public.keuangan_tabungan_santri (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  jenis      text not null check (jenis in ('setor','tarik')),
  nominal    bigint not null check (nominal > 0),
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_tabungan_santri_santri_idx on public.keuangan_tabungan_santri (tenant_id, santri_id);
create index keuangan_tabungan_santri_tgl_idx    on public.keuangan_tabungan_santri (tenant_id, tanggal);

create table public.keuangan_uang_saku_santri (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  jenis      text not null check (jenis in ('setor','tarik')),
  nominal    bigint not null check (nominal > 0),
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_uang_saku_santri_santri_idx on public.keuangan_uang_saku_santri (tenant_id, santri_id);

create table public.keuangan_gaji (
  tenant_id       uuid not null default public.current_tenant_id() references public.tenants(id),
  id              text not null,
  guru_id         text,
  periode         text,
  bisyaroh_pokok  bigint not null default 0 check (bisyaroh_pokok >= 0),
  total_pemasukan bigint not null default 0 check (total_pemasukan >= 0),
  total_potongan  bigint not null default 0 check (total_potongan >= 0),
  tunjangan_list  jsonb not null default '[]'::jsonb,
  potongan_list   jsonb not null default '[]'::jsonb,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_gaji_guru_idx    on public.keuangan_gaji (tenant_id, guru_id);
create index keuangan_gaji_periode_idx on public.keuangan_gaji (tenant_id, periode);

create table public.keuangan_hutang_piutang (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  nominal    bigint check (nominal >= 0),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.keuangan_pembayaran (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  nominal    bigint check (nominal >= 0),
  tanggal    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index keuangan_pembayaran_santri_idx on public.keuangan_pembayaran (tenant_id, santri_id);

create table public.tabungan_mutasi (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  ref_id     text,
  nominal    bigint,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.pengaturan_keuangan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.pembayaran_konfirmasi (
  tenant_id        uuid not null default public.current_tenant_id() references public.tenants(id),
  id               text not null,
  santri_id        text,
  nominal          bigint check (nominal >= 0),
  status           text,
  tanggal_transfer text,
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index pembayaran_konfirmasi_status_idx on public.pembayaran_konfirmasi (tenant_id, status);

create table public.pembayaran_transfer_pending (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  santri_id  text,
  nominal    bigint check (nominal >= 0),
  status     text not null default 'pending',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index pembayaran_transfer_pending_status_idx on public.pembayaran_transfer_pending (tenant_id, status);

-- ---- Trigger updated_at + RLS ----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'keuangan_tagihan','keuangan_buku_induk','keuangan_tabungan_santri',
    'keuangan_uang_saku_santri','keuangan_gaji','keuangan_hutang_piutang',
    'keuangan_pembayaran','tabungan_mutasi','pengaturan_keuangan',
    'pembayaran_konfirmasi','pembayaran_transfer_pending'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Archetype C (read signedIn, write keuangan, delete super) — tenant-scoped.
do $$
declare t text;
begin
  foreach t in array array[
    'keuangan_tagihan','keuangan_buku_induk','keuangan_tabungan_santri',
    'keuangan_uang_saku_santri','keuangan_gaji','keuangan_hutang_piutang',
    'keuangan_pembayaran','tabungan_mutasi','pengaturan_keuangan'
  ] loop
    execute format('create policy %I on public.%I for select using (auth.uid() is not null and tenant_id = public.current_tenant_id())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (public.auth_can_keuangan() and tenant_id = public.current_tenant_id())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (public.auth_can_keuangan() and tenant_id = public.current_tenant_id()) with check (public.auth_can_keuangan() and tenant_id = public.current_tenant_id())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (public.auth_is_super() and tenant_id = public.current_tenant_id())', t||'_del', t);
  end loop;
end $$;

-- PEMBAYARAN_KONFIRMASI + _TRANSFER_PENDING: read/create signedIn, upd/del keuangan.
do $$
declare t text;
begin
  foreach t in array array['pembayaran_konfirmasi','pembayaran_transfer_pending'] loop
    execute format('create policy %I on public.%I for select using (auth.uid() is not null and tenant_id = public.current_tenant_id())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() is not null and tenant_id = public.current_tenant_id())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (public.auth_can_keuangan() and tenant_id = public.current_tenant_id()) with check (public.auth_can_keuangan() and tenant_id = public.current_tenant_id())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (public.auth_can_keuangan() and tenant_id = public.current_tenant_id())', t||'_del', t);
  end loop;
end $$;
