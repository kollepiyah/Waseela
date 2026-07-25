# supabase/migrations — WASEELA (MULTI-TENANT)

Skema Postgres Waseela. Auto-apply lewat integrasi GitHub Supabase saat push
(urut prefix timestamp `YYYYMMDDHHMMSS_deskripsi.sql`).

## Konvensi WAJIB (beda dari Ammu single-tenant)

- **`tenant_id`** di **SETIAP** tabel domain: `uuid not null default public.current_tenant_id()
  references public.tenants(id)`. Ini satu-satunya batas isolasi antar-pesantren.
- **Index `(tenant_id)`** di setiap tabel (+ composite dengan kolom query panas).
- **RLS**: tiap policy `select/insert/update/delete` menambah
  `AND tenant_id = public.current_tenant_id()` di `using`/`with check`.
- Uang = `bigint`; tanggal = `text 'YYYY-MM-DD'`; field dinamis = `jsonb` (sama Ammu).
- Seeding & edge function (service_role) **BYPASS RLS** → wajib set `tenant_id` EKSPLISIT
  (default `current_tenant_id()` = NULL tanpa sesi user login).

## Urutan port (dari 33 migration Ammu → versi multi-tenant Waseela)

| # | Waseela | Sumber Ammu | Isi |
|---|---------|-------------|-----|
| 00 | `..._mt_foundation.sql` ✅ | `init_foundation` + `profiles_rls` | extensions, `tenants`, `current_tenant_id()`, `profiles`(+tenant_id), helper peran, pola RLS |
| 01 | (Fase 2) | `core` | santri/guru/lembaga/master/settings + tenant_id |
| 02 | (Fase 2) | `keuangan` | tagihan/tabungan/pos/bisyaroh/hutang + tenant_id |
| 03 | (Fase 2) | `akademik` | rapor/rekap/kenaikan/absensi + tenant_id |
| 04 | (Fase 2) | `konten` | posts/kegiatan/kritik/psb + tenant_id |
| 05 | (Fase 2) | `realtime_grants`+`auth_login`+`push`+`storage`+RPC | scoped per-tenant |
| 06+ | (Fase 2) | incremental (bmt_va, glondongan, pengaduan, ceremonial, rls_locks, push_multi_device, ...) | fitur baru + hardening |

> **CHECKPOINT KEAMANAN:** model isolasi tenant di `00_mt_foundation` HARUS ditinjau
> sebelum Fase 2. Salah = data bocor antar-lembaga (lihat MIGRATION-PLAN.md).
