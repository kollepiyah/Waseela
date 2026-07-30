-- ============================================================================
-- WASEELA · PLATFORM OWNER — konsol super-admin vendor (Bakafrawi) kelola SEMUA
-- tenant + langganan/pembelian. Peran DI ATAS super_admin per-tenant.
--
-- Model peran:
--   super_admin  = admin tertinggi DALAM 1 lembaga (tenant-scoped, spt sekarang).
--   platform_owner = pemilik platform: LINTAS-tenant (tenant_id NULL), kelola registry
--                    tenant + langganan. Tidak terikat 1 lembaga.
--
-- Keamanan: helper di schema `private` (tak ter-expose RPC). platform_owner
--   mem-bypass tenant-scope HANYA di tabel platform (tenants, langganan) — TIDAK
--   otomatis membaca data santri/guru lembaga (privasi). Akses data lembaga
--   tertentu = lewat konteks/impersonate terpisah (menyusul, bila diperlukan).
-- ============================================================================

-- ---- Helper peran platform (di private, tenant-agnostik) --------------------
create or replace function private.auth_is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.auth_role_sistem() = 'platform_owner', false)
$$;
grant execute on function private.auth_is_platform_owner() to anon, authenticated;

-- ---- tenants: platform_owner akses penuh LINTAS-tenant (aditif, OR permissive) ----
drop policy if exists tenants_owner_all on public.tenants;
create policy tenants_owner_all on public.tenants for all
  using (private.auth_is_platform_owner())
  with check (private.auth_is_platform_owner());

-- ---- langganan / pembelian --------------------------------------------------
create table if not exists public.langganan (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  plan         text not null default 'basic',       -- basic | pro | premium
  harga        bigint not null default 0,           -- rupiah (0 = gratis/trial)
  status       text not null default 'pending',     -- pending|paid|active|expired|dibatalkan
  periode      text,                                 -- bulanan | tahunan | sekali
  mulai        date,
  berakhir     date,                                 -- tanggal kadaluarsa langganan
  metode_bayar text,                                 -- transfer | tunai | qris | dst
  invoice_no   text,
  catatan      text,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists langganan_tenant_idx  on public.langganan (tenant_id);
create index if not exists langganan_status_idx  on public.langganan (status);
create index if not exists langganan_berakhir_idx on public.langganan (berakhir);
drop trigger if exists set_updated_at on public.langganan;
create trigger set_updated_at before update on public.langganan for each row execute function public.set_updated_at();
grant all on public.langganan to authenticated, service_role;

alter table public.langganan enable row level security;

-- platform_owner: kelola SEMUA langganan.
drop policy if exists langganan_owner_all on public.langganan;
create policy langganan_owner_all on public.langganan for all
  using (private.auth_is_platform_owner())
  with check (private.auth_is_platform_owner());

-- admin tenant: BOLEH BACA langganan lembaganya sendiri (mis. tampil status paket).
drop policy if exists langganan_tenant_read on public.langganan;
create policy langganan_tenant_read on public.langganan for select
  using (tenant_id = private.current_tenant_id() and private.auth_can_manage());
