-- ============================================================================
-- WASEELA · MT-07 PENGADUAN (multi-tenant) — port Ammu pengaduan + sync_guru_profile_role.
-- Channel pengaduan formal (TERPISAH dari kritik_saran), privacy-aware:
--   staff/KORLAP baca semua; pengirim baca miliknya (data->>'pengirim_uid').
--
-- ⚠️ FIX MULTI-TENANT: sync_guru_profile_role Ammu `update profiles where guru_id=new.id`
--    akan kena SEMUA tenant (guru_id 'g1' bisa ada di banyak lembaga). Di-scope
--    `AND tenant_id = new.tenant_id`.
-- ============================================================================

-- KORLAP flag di profiles (cermin kolom `supervisi`).
alter table public.profiles add column if not exists pengaduan boolean not null default false;

-- Helper RLS: kelola/baca-semua pengaduan = manage ATAU KORLAP.
create or replace function public.auth_can_pengaduan()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_can_manage()
    or (select pengaduan from public.profiles where id = auth.uid()), false)
$$;

-- Sync guru -> profiles (role_sistem/role + KORLAP dari jabatan) — TENANT-SCOPED.
create or replace function public.sync_guru_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rs text; v_role text; v_korlap boolean;
begin
  v_rs := case new.role_sistem
            when 'super_admin' then 'super_admin'
            when 'admin' then 'admin'
            when 'admin_keuangan' then 'admin_keuangan'
            else 'guru' end;
  v_role := case when v_rs in ('admin','admin_keuangan','super_admin') then 'admin' else 'guru' end;
  v_korlap := (coalesce(new.jabatan, '') ~* 'koordinator lapangan|korlap'
            or coalesce(new.jabatan_tambahan, '') ~* 'koordinator lapangan|korlap');
  update public.profiles
    set role_sistem = v_rs, role = v_role, pengaduan = v_korlap
    where guru_id = new.id and tenant_id = new.tenant_id;   -- FIX: scope tenant
  return new;
end $$;
drop trigger if exists trg_sync_guru_profile_role on public.guru;
create trigger trg_sync_guru_profile_role
  after update on public.guru
  for each row
  when (new.role_sistem      is distinct from old.role_sistem
     or new.jabatan          is distinct from old.jabatan
     or new.jabatan_tambahan is distinct from old.jabatan_tambahan)
  execute function public.sync_guru_profile_role();

-- ---- Tabel pengaduan (multi-tenant) ----------------------------------------
create table if not exists public.pengaduan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  pesan      text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index if not exists pengaduan_created_idx on public.pengaduan (tenant_id, created_at);
drop trigger if exists set_updated_at on public.pengaduan;
create trigger set_updated_at before update on public.pengaduan for each row execute function public.set_updated_at();
grant all on public.pengaduan to anon, authenticated, service_role;

alter table public.pengaduan enable row level security;
create policy pengaduan_sel on public.pengaduan for select using (
  tenant_id = public.current_tenant_id()
  and (public.auth_can_pengaduan() or (data->>'pengirim_uid') = auth.uid()::text)
);
create policy pengaduan_ins on public.pengaduan for insert with check (
  auth.uid() is not null and tenant_id = public.current_tenant_id()
  and char_length(coalesce(pesan, '')) between 1 and 2000
);
create policy pengaduan_upd on public.pengaduan for update
  using (public.auth_can_pengaduan() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_pengaduan() and tenant_id = public.current_tenant_id());
create policy pengaduan_del on public.pengaduan for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- Realtime (idempoten).
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='pengaduan') then
    execute 'alter publication supabase_realtime add table public.pengaduan';
  end if;
end $$;
