-- ============================================================================
-- WASEELA · MT-01 CORE (multi-tenant) — port dari Ammu core + profiles_rls.
-- santri, guru, lembaga, master, settings.
-- Transform vs Ammu: + tenant_id, PK komposit (tenant_id, id/key), index ber-prefix
-- tenant_id, RLS tiap policy + `AND tenant_id = public.current_tenant_id()`.
-- ============================================================================

create table public.santri (
  tenant_id       uuid not null default public.current_tenant_id() references public.tenants(id),
  id              text not null,
  nis             text,
  nisn            text,
  nik             text,
  nama            text not null,
  jk              text,
  lembaga         text,
  kelas           text,
  lembaga_sekolah text,
  kelas_sekolah   text,
  juz             text,
  wali            text,
  wa              text,
  aktif           boolean not null default true,
  is_mukim        boolean not null default false,
  is_fullday      boolean not null default false,
  foto            text,
  data            jsonb   not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index santri_lembaga_kelas_idx         on public.santri (tenant_id, lembaga, kelas);
create index santri_lembaga_sekolah_kelas_idx on public.santri (tenant_id, lembaga_sekolah, kelas_sekolah);
create index santri_aktif_idx                 on public.santri (tenant_id, aktif);
create index santri_nama_trgm_idx             on public.santri using gin (nama extensions.gin_trgm_ops);
create index santri_data_gin_idx              on public.santri using gin (data jsonb_path_ops);

create table public.guru (
  tenant_id        uuid not null default public.current_tenant_id() references public.tenants(id),
  id               text not null,
  nama             text not null,
  nik              text,
  jk               text,
  jabatan          text,
  jabatan_tambahan text,
  lembaga          text,
  lembaga_sekolah  text,
  tipe_pegawai     text,
  shift            text,
  status           text not null default 'aktif',
  username         text,
  wa               text,
  foto             text,
  role_sistem      text not null default 'user',
  id_fingerprint   text,
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index guru_lembaga_idx   on public.guru (tenant_id, lembaga);
create index guru_jabatan_idx   on public.guru (tenant_id, jabatan);
create index guru_status_idx    on public.guru (tenant_id, status);
create index guru_nama_trgm_idx on public.guru using gin (nama extensions.gin_trgm_ops);

create table public.lembaga (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  nama       text,
  urutan     int,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.master (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table public.settings (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ---- Trigger updated_at ----------------------------------------------------
create trigger set_updated_at before update on public.santri  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.guru    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.lembaga for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.master  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.settings for each row execute function public.set_updated_at();

-- ---- RLS (semua tenant-scoped) ---------------------------------------------
alter table public.santri   enable row level security;
alter table public.guru     enable row level security;
alter table public.lembaga  enable row level security;
alter table public.master   enable row level security;
alter table public.settings enable row level security;

-- SANTRI: read signedIn, write manage / self-edit, delete super — semua dalam tenant.
create policy santri_sel on public.santri for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy santri_ins on public.santri for insert
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy santri_upd_manage on public.santri for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy santri_upd_self on public.santri for update
  using (tenant_id = public.current_tenant_id()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.santri_id = santri.id))
  with check (tenant_id = public.current_tenant_id()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.santri_id = santri.id));
create policy santri_del on public.santri for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- GURU: idem santri (self via guru_id).
create policy guru_sel on public.guru for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy guru_ins on public.guru for insert
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy guru_upd_manage on public.guru for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy guru_upd_self on public.guru for update
  using (tenant_id = public.current_tenant_id()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.guru_id = guru.id))
  with check (tenant_id = public.current_tenant_id()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.guru_id = guru.id));
create policy guru_del on public.guru for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- LEMBAGA + MASTER: archetype A (read dlm-tenant, write manage, delete super).
do $$
declare t text;
begin
  foreach t in array array['lembaga','master'] loop
    execute format('create policy %I on public.%I for select using (tenant_id = public.current_tenant_id())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (public.auth_can_manage() and tenant_id = public.current_tenant_id())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (public.auth_can_manage() and tenant_id = public.current_tenant_id()) with check (public.auth_can_manage() and tenant_id = public.current_tenant_id())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (public.auth_is_super() and tenant_id = public.current_tenant_id())', t||'_del', t);
  end loop;
end $$;

-- SETTINGS: read semua kunci KECUALI 'admin' (dlm-tenant); write manage; del super.
create policy settings_sel on public.settings for select
  using (key <> 'admin' and tenant_id = public.current_tenant_id());
create policy settings_ins on public.settings for insert
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy settings_upd on public.settings for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy settings_del on public.settings for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());
