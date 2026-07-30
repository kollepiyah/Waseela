# 🚀 WASEELA — Runbook Deploy Supabase (DB, Edge Functions, Migrasi Data)

> Target project: `vfbmaywcjurykxfetbia` (ap-southeast-1). Semua migrasi sejauh ini
> diterapkan **via MCP** (bukan `db push`) — baca **§0 Rekonsiliasi** sebelum `db push`.

---

## 0. ⚠️ Rekonsiliasi (SUDAH DIBERESKAN 30 Jul — konteks + cara)

Migrasi diterapkan via **MCP `apply_migration`**, yang menstempel versi **apply-time**
(mis. `20260724225111`), BEDA dari nomor file lokal awal (`20260725000000`). Isi SAMA,
nomor beda → `supabase db push` bilang *"Remote migration versions not found in local"*.

**FIX yang dipakai (terbersih): rename file lokal agar cocok versi remote.** Sudah dilakukan —
16 file di `supabase/migrations/` kini bernomor = versi remote (lihat `supabase migration list`
harusnya sejajar Local=Remote). JANGAN pakai `migration repair --status reverted` lalu push
(akan menjalankan ulang → "already exists"), dan JANGAN `db pull` (membuang riwayat per-migrasi).

Verifikasi:
```bash
supabase migration list      # semua baris Local == Remote
supabase db push             # → "Remote database is up to date"
```

**KE DEPAN (penting):** untuk migrasi BARU, pakai `supabase migration new <name>` + `supabase db push`
(bukan MCP) supaya versi lokal = remote otomatis. Kalau tetap pakai MCP apply, rename filenya agar
cocok versi remote seperti di atas.

---

## 1. Prasyarat (sekali)

```bash
npm i -g supabase                       # atau: npx supabase ...
supabase login
cd "D:/Aplikasi Project/Waseela"
supabase link --project-ref vfbmaywcjurykxfetbia
```

Kredensial (JANGAN commit):
- **Publishable key** (frontend) → `app/.env.local` `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **service_role key** (server/skrip) → hanya di env lokal / secret CI, TIDAK di repo.
  Ambil: Dashboard → Settings → API.

> **CATATAN env OS**: pastikan TIDAK ada `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
> basi di environment shell (project lama). Ini menang atas `.env.local`.
> Cek — PowerShell: `Get-ChildItem Env:VITE_SUPABASE*` · bash: `printenv | grep VITE_SUPABASE`.
> Hapus — PowerShell: `Remove-Item Env:VITE_SUPABASE_URL` (sesi ini) atau restart terminal · bash: `unset ...`.

---

## 2. Manual dashboard (2 hal — HANYA bisa lewat dashboard)

1. **Authentication → Providers**: Email **ON**, "Confirm email" **OFF** (domain `.local`
   tak terkirim → butuh auto-confirm agar signUp langsung punya sesi).
2. **Authentication → Hooks**: HAPUS "Custom Access Token" hook (`app.custom_access_token_hook`).
   Arsitektur kita tak pakai JWT-claims. Ada no-op bridge (migrasi `20260730000200`) supaya
   login jalan; setelah hook dihapus, boleh: `drop function app.custom_access_token_hook; drop schema app;`.
3. **Settings → API → Exposed schemas**: pastikan hanya `public` (+`graphql_public`). JANGAN `app`/`private`.

---

## 3. DB migrations

```bash
# lihat status
supabase migration list
# terapkan migrasi BARU (setelah reconcile §0)
supabase db push
```
Alternatif tanpa CLI: terapkan file `.sql` via SQL Editor / MCP `apply_migration`.

Migrasi kini (urut): mt_foundation → core → keuangan → akademik → konten → auth_login →
realtime_grants → pengaduan → ptpt_features → rls_ptpt_lock → **fase7_hardening** →
**fase7_private_helpers** → **auth_hook_noop_bridge** → **platform_owner** → **platform_stats** →
**admin_reset_rpc**.

---

## 4. Edge Functions

```bash
# set secret dulu (per fungsi yang butuh — lihat tabel §6)
supabase secrets set FCM_SERVER_KEY=xxx
# deploy semua, atau satu
supabase functions deploy
supabase functions deploy reset-user-password
```
> `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` di-inject platform (jangan set manual).
> Fungsi yang panggil dari browser: deploy dengan `--no-verify-jwt` bila menangani CORS+auth sendiri
> (fungsi kita sudah begitu). Contoh: `supabase functions deploy reset-user-password --no-verify-jwt`.

**Sudah ACTIVE di project:** `provision-tenant-admin`, `reset-user-password`.

---

## 5. Migrasi BULK data (Firestore → Supabase, per-tenant)

Install deps sekali (di root repo, biar `node_modules` root ada utk skrip):
```bash
npm i firebase-admin @supabase/supabase-js
```

Butuh **service account JSON** project Firebase SUMBER (Firebase Console → Project Settings →
Service Accounts → Generate new private key). Ganti `<...>` dengan nilai asli — JANGAN ketik tanda `<>`.

**PowerShell (Windows) — `$env:`, BUKAN `export`:**
```powershell
$env:FIREBASE_SERVICE_ACCOUNT = "D:\Aplikasi Project\Waseela\service-account.json"
$env:SUPABASE_URL = "https://vfbmaywcjurykxfetbia.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "PASTE_SERVICE_ROLE_KEY"
node scripts/migrate-firestore-to-supabase.mjs demo --dry      # ganti 'demo' = slug tenant asli
node scripts/migrate-firestore-to-supabase.mjs demo            # eksekusi
node scripts/migrate-firestore-to-supabase.mjs demo --only=santri,guru
```

**bash/macOS/Linux:**
```bash
export FIREBASE_SERVICE_ACCOUNT="/path/service-account.json"
export SUPABASE_URL="https://vfbmaywcjurykxfetbia.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="PASTE_SERVICE_ROLE_KEY"
node scripts/migrate-firestore-to-supabase.mjs demo --dry
```

> tenant slug HARUS sudah ada di `public.tenants` (buat via konsol `/konsol` dulu).
> Idempoten (UPSERT on `tenant_id,pk`). Peta skema skrip WAJIB sinkron dg `app/src/services/db.js`.

---

## 6. Status Edge Functions (port dari Ammu → multi-tenant)

| Fungsi | Status | Butuh sebelum produksi |
|---|---|---|
| `provision-tenant-admin` | ✅ **deployed** (baru, Waseela) | — |
| `reset-user-password` | ✅ **deployed** (port + RPC `admin_target_auth_uid`) | — |
| `auto-generate-tagihan` | ⏳ belum port | `pg_cron` schedule + tenant-loop; baca `keuangan_tagihan`+template |
| `dispatch-push` | ⏳ belum port | **secret FCM** (`FCM_SERVER_KEY`), tabel `notif_queue`, token per-tenant |
| ~~`bmt-webhook`~~ | ❌ **TIDAK DIPAKAI Waseela** (dibuang) | — |
| `get-link-preview` | ⏳ belum port | tabel `link_preview_cache` (sudah ada); relatif ringan |
| `hiview-absen` | ⏳ belum port | integrasi mesin Hiview/Fingerspot + kredensial; kompleks |

**Pola port** (contoh `reset-user-password`): tiap fungsi Ammu yang single-tenant perlu
(a) RPC pendukung di-scope tenant (`private.current_tenant_id()` + guard peran), (b) email/slug
per-tenant, (c) header `x-tenant` diteruskan. Kerjakan per-fungsi saat fiturnya diaktifkan +
secret tersedia (fungsi tak berguna tanpa secret/integrasinya).

---

## 7. Frontend (per-tenant build)

```bash
cd app
node ../scripts/build-tenant.mjs <slug>      # generate tenant.config + assets
npm run build                                 # dist/
# deploy dist/ ke hosting (Firebase Hosting / Vercel / static). Set .env per build:
#   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_TENANT_SLUG=<slug>
#   VITE_AUTH_BACKEND=supabase, VITE_DATA_BACKEND=supabase   (tenant produksi = full Supabase)
```
Konsol owner (`/konsol`): sama build, login `owner`. Demo showcase: `VITE_*_BACKEND=firebase`.
