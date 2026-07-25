-- ============================================================================
-- WASEELA · MT-00 FOUNDATION (MULTI-TENANT) — port dari Ammu single-tenant.
--
-- ⚠️  REVIEW CHECKPOINT (KEAMANAN): file ini MENETAPKAN MODEL ISOLASI TENANT.
--     Satu project Supabase, semua lembaga berbagi tabel, dipisah kolom
--     `tenant_id` + RLS. SALAH DI SINI = data bocor antar-pesantren.
--     Tinjau desain ini SEBELUM Fase 2 (port 30+ migration domain) dijalankan.
--
--     Beda dari Ammu (single-tenant):
--       Ammu    : RLS cek PERAN saja (auth_is_super / auth_can_manage / ...).
--       Waseela : RLS cek PERAN **DAN** tenant_id = public.current_tenant_id().
-- ============================================================================

-- ---- Extensions + util (identik Ammu foundation) ---------------------------
create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- Registry lembaga (tenant) ---------------------------------------------
create table public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,            -- 'demo','al-hikmah' (= folder tenants/<slug>)
  nama       text not null,
  plan       text not null default 'basic',   -- basic|pro|premium (cermin app/src/config/plans.js)
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- PROFILES (identitas peran + tenant) -----------------------------------
-- (Catatan urutan: current_tenant_id() didefinisikan SETELAH profiles karena
--  fungsi `language sql` divalidasi bodinya saat CREATE — profiles harus sudah ada.)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id),  -- NULL sampai admin lembaga assign
  login_key   text,                                -- username/WA/NIS (UNIK PER-TENANT, index bawah)
  role        text not null default 'santri',      -- admin | guru | santri (bucket UI)
  role_sistem text not null default 'santri',      -- super_admin|admin|admin_keuangan|guru_biasa|user|santri
  supervisi   boolean not null default false,
  santri_id   text,
  guru_id     text,
  akses       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- login_key UNIK PER-TENANT (bukan global) -> username 'admin' boleh ada di tiap lembaga.
create unique index profiles_tenant_login_uniq on public.profiles (tenant_id, login_key);
create index profiles_tenant_idx on public.profiles (tenant_id);
create index profiles_santri_idx on public.profiles (santri_id);
create index profiles_guru_idx   on public.profiles (guru_id);

-- Lazy-create profil saat auth user baru. tenant_id DIBIARKAN NULL -> di-assign
-- admin lembaga (akun disediakan admin per-lembaga; belum ada self-signup).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login_key, role, role_sistem)
  values (new.id, split_part(coalesce(new.email,''), '@', 1), 'santri', 'santri')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Helper peran (SAMA Ammu; otomatis tenant-aware krn baca profiles user) -
create or replace function public.auth_role_sistem()
returns text language sql stable security definer set search_path = public as $$
  select role_sistem from public.profiles where id = auth.uid()
$$;
create or replace function public.auth_is_super()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role_sistem() = 'super_admin', false)
$$;
create or replace function public.auth_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role_sistem() in ('super_admin','admin'), false)
$$;
create or replace function public.auth_can_keuangan()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role_sistem() in ('super_admin','admin_keuangan'), false)
$$;
create or replace function public.auth_can_akademik()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role_sistem() in ('super_admin','admin','guru'), false)
$$;
create or replace function public.auth_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role_sistem() in ('super_admin','admin','admin_keuangan','guru'), false)
$$;
create or replace function public.auth_can_supervisi()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_is_super()
    or (select supervisi from public.profiles where id = auth.uid()), false)
$$;

-- ---- Resolusi tenant milik user login --------------------------------------
-- LOGIN  : sumber kebenaran = profiles.tenant_id (di-set admin saat provisioning).
-- ANON   : fallback ke header build `x-tenant` = slug (login page/PSB/posts publik
--          butuh tenant TANPA sesi). Build per-tenant menyetel header ini
--          (services/supabase.js dari VITE_SUPABASE_TENANT_SLUG).
-- KEAMANAN: profiles didahulukan -> user login TAK BISA lompat-tenant via header
--          palsu (header hanya dipakai saat auth.uid() null). Anon hanya bisa
--          baca data PUBLIK tenant lain (yang memang publik) — bukan kebocoran PII.
-- SECURITY DEFINER -> baca profiles tanpa memicu RLS (hindari rekursi).
-- (Optimasi opsional nanti: pindah resolusi login ke JWT app_metadata.)
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select tenant_id from public.profiles where id = auth.uid()),
    (select id from public.tenants
       where slug = nullif(
         current_setting('request.headers', true)::json ->> 'x-tenant', ''))
  )
$$;

-- ---- RLS tenants + profiles ------------------------------------------------
alter table public.tenants  enable row level security;
alter table public.profiles enable row level security;

-- tenants: user hanya lihat/ubah tenant miliknya (super saja utk tulis).
create policy tenants_sel on public.tenants for select
  using (id = public.current_tenant_id());
create policy tenants_all on public.tenants for all
  using (public.auth_is_super() and id = public.current_tenant_id())
  with check (public.auth_is_super() and id = public.current_tenant_id());

-- profiles: baca self / manage (DALAM tenant); tulis manage; cegah pindah-tenant.
create policy profiles_sel on public.profiles for select
  using ((id = auth.uid())
      or (public.auth_can_manage() and tenant_id = public.current_tenant_id()));
create policy profiles_ins on public.profiles for insert
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy profiles_upd on public.profiles for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy profiles_del on public.profiles for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- ============================================================================
-- 📐 POLA BAKU tabel-data tenant-scoped — DIPAKAI FASE 2 UNTUK SEMUA TABEL DOMAIN
--
--    Tiap tabel domain WAJIB:
--      1) kolom  tenant_id uuid not null default public.current_tenant_id()
--                references public.tenants(id)
--      2) index  (tenant_id)  [+ composite dg kolom query panas]
--      3) tiap policy tambah  AND tenant_id = public.current_tenant_id()
--         (insert/update pakai WITH CHECK tenant_id = public.current_tenant_id())
--
--    CONTOH (arketipe-B Ammu: read signedIn, write akademik, delete super):
--
--      alter table public.absensi
--        add column tenant_id uuid not null default public.current_tenant_id()
--        references public.tenants(id);
--      create index absensi_tenant_idx on public.absensi (tenant_id);
--
--      create policy absensi_sel on public.absensi for select
--        using (auth.uid() is not null
--               and tenant_id = public.current_tenant_id());
--      create policy absensi_ins on public.absensi for insert
--        with check (public.auth_can_akademik()
--               and tenant_id = public.current_tenant_id());
--      create policy absensi_upd on public.absensi for update
--        using (public.auth_can_akademik() and tenant_id = public.current_tenant_id())
--        with check (public.auth_can_akademik() and tenant_id = public.current_tenant_id());
--      create policy absensi_del on public.absensi for delete
--        using (public.auth_is_super() and tenant_id = public.current_tenant_id());
-- ============================================================================
