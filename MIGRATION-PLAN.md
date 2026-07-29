# 🚚 MIGRATION-PLAN — Waseela: Firebase → Supabase (multi-tenant)

> Dibuat 25 Jul 2026. Sumber kebenaran rencana migrasi. Baca ini + `HANDOVER.md`.
> Status per-fase diperbarui tiap ada kemajuan. Repo pola: Ammu (`D:\Aplikasi Project\Portal MU`).

---

## 0. TEMUAN PENTING (kenapa ini besar, bukan copy-paste)

Ammu & Waseela sudah **bercabang arsitektur**:

| | Ammu (`vue-app`) | Waseela (`app`) |
|---|---|---|
| Backend | **Firebase + Supabase** (`@supabase/supabase-js`, 33 migration, RLS, `@tanstack/vue-query`) | **Firebase saja** (snapshot ~Jun) |
| Tenancy | **Single-tenant** (1 project = Mambaul Ulum), tanpa `tenant_id` | **Multi-tenant** (target: 1 project = banyak pesantren) |

Fitur & keamanan RLS baru Ammu dibangun **di atas Supabase**. Jadi tujuan tugas ini:
port Ammu → Waseela **sambil menambah lapisan multi-tenant** (`tenant_id` + RLS scoping)
yang TIDAK ada di Ammu. Ammu = pathfinder; Waseela pakai ulang polanya + isolasi tenant.

**Keputusan user (25 Jul):** migrasi ke Supabase **sekarang**, walau belum ada pembeli.

---

## 1. REALITAS "SCHEDULED TASK" (dijawab langsung)

- **Cloud routine / scheduled agent Anthropic** → jalan di server Anthropic, **TIDAK bisa
  akses drive `D:\`** tempat kedua repo. Migrasi ini baca repo Ammu + edit repo Waseela →
  **tak bisa** dijadikan cloud scheduled task. (definitif)
- **Windows Task Scheduler → `claude` headless jam 3 pagi** → teknis bisa jalan LOKAL, tapi:
  1. Langkah **resume DB Supabase** butuh aksi manual kamu di dashboard (billing/slot Free) —
     tak ada agen headless yang bisa klik "Resume" + bereskan limit.
  2. Menulis/menerapkan **RLS multi-tenant tanpa pengawasan** = risiko bocor data antar-pesantren.
  3. PC harus menyala.
- **Jalur realistis (dipakai):** kerja **file-level lokal SEKARANG** (SQL/adapter/view — semua
  cuma file di git, app Firebase tetap jalan) → langkah **live-DB** (resume → apply → uji RLS →
  seed → cutover) dikerjakan **bareng** saat kamu kembali, karena gated di resume manual + wajib review.

---

## 2. GERBANG WAJIB KAMU (blocker manual — hanya kamu yang bisa)

1. **Resume project Supabase "Waseela"** — SEKARANG terblokir: akun `kollepiyah` mentok
   **2/2 project Free**. Supaya bisa Resume, salah satu:
   - Pause/hapus 1 project Free lain (cek mana yang benar-benar dipakai), **atau**
   - **Upgrade Pro ($25/bln)** project Waseela / yang lain.
   > Catatan: HANDOVER-mu bilang go-Pro = "saat ada pembeli". Belum ada pembeli → menaikkan
   > biaya lebih awal. Alternatif hemat: buat **project Supabase Free BARU** khusus Waseela di
   > organization terpisah (kuota Free sendiri) untuk fase dev/pilot, upgrade Pro nanti saat deal.
2. Setelah aktif: catat **project ref** → isi `supabase/config.toml` + set `VITE_SUPABASE_URL`
   & `VITE_SUPABASE_ANON_KEY` (per build tenant).

---

## 3. MODEL MULTI-TENANT (⚠️ CHECKPOINT KEAMANAN — tinjau sebelum Fase 2)

Sudah discaffold di `supabase/migrations/20260725000000_mt_foundation.sql`:

- **`tenants`** = registry lembaga (`slug`, `nama`, `plan`, `aktif`).
- **`current_tenant_id()`** = tenant milik user login, dibaca dari `profiles.tenant_id`
  (SECURITY DEFINER, bypass RLS). Optimasi opsional: pindah ke JWT `app_metadata`.
- **`profiles`** dapat `tenant_id`; `login_key` **unik per-tenant** (username `admin` boleh ada
  di tiap lembaga).
- **Pola baku:** tiap tabel domain dapat `tenant_id not null default current_tenant_id()` +
  index + RLS `AND tenant_id = current_tenant_id()`. Helper peran Ammu (`auth_can_manage`, dst)
  dipakai ulang apa adanya (otomatis tenant-aware karena baca profil user).

**Butuh keputusanmu di titik ini:**
- (a) Resolusi tenant: `profiles.tenant_id` (dipilih, robust) vs JWT `app_metadata` (lebih cepat)?
- (b) Provisioning akun per-tenant: tetap admin-buat (belum self-signup) — konfirmasi.
- (c) Wajib: **RLS isolation test** (pgTAP / skrip) sebelum ada data produksi — 1 baris salah = bocor.

---

## 4. FASE (status)

| Fase | Isi | Butuh live DB? | Status |
|------|-----|:---:|--------|
| **1. Fondasi** | `supabase/` scaffold, `config.toml`, migration `mt_foundation` (+anon `x-tenant` fallback), `services/supabase.js`+`queryClient.js`, deps `@supabase/*`+`vue-query` | ❌ | ✅ **SELESAI (file, perlu review)** |
| **2a. Skema dasar** | Port `core`+`keuangan`+`akademik`+`konten` → multi-tenant: **47 tabel** (tenant_id, PK komposit, index ber-prefix, updated_at trigger) + **74 RLS policy** tenant-scoped | ✅ | ✅ **SELESAI + APPLIED + RLS ISOLATION TEST LULUS** (25 Jul, project `vfbmaywcjurykxfetbia`) — 5/5 cek: no cross-tenant read/write, anon scoped ke tenant build, anon tak baca PII |
| **2b-auth. Auth login** | `resolve_login` RPC (username/WA/NIS→email, **per-tenant** via header) + `handle_new_user` (tenant dari slug email + mapping peran) + email namespaced `<key>@<slug>.waseela.local` + admin='admin' (white-label) | ✅ | ✅ **SELESAI + APPLIED + TEST LULUS 9/9** (resolve admin/guru/santri, WA→kanonik, **cross-tenant login diblok**, lazy-create profil benar) |
| **2b-realtime. Grants+realtime** | `grant` PostgREST roles + `supabase_realtime` publication **32 tabel** whitelist (cermin `db.js` REALTIME; RLS berlaku utk broadcast → isolasi realtime) | ✅ | ✅ **SELESAI + APPLIED** (`mt_realtime_grants`) |
| **2b-sisa. Skema sisa** | `storage_policies`, `push`/RPC (`save_push_token`, `analytics`), incremental (bmt_va, glondongan, pengaduan, ceremonial, rls_locks, push_multi_device, wali_pii_scope) | ❌ tulis / ✅ apply | ⏳ **NEXT** |
| **3. Adapter data** | `db.js` (tenant-agnostik) ✅ + `authSupabase.js` ✅ + wire `main.js` (VueQueryPlugin) ✅. **`npm install` + `vite build` HIJAU** (built 54s, adapter+vue-query ter-compile, Firebase utuh). Sisa: `storage.js` adapter, **flip auth store** + cutover import view Firestore→db.js (gated: REST Healthy + tes browser) | ✅ build | 🟡 **wiring+build SELESAI**; flip backend ⏳ |
| **4. Fitur baru** | ✅ Mapping paket (`plans.js`) + ✅ semua tabel DB (`pengaduan`, `tes_glondongan`, `ceremonial_ptpt`) + ✅ RLS lock PTPT (test 5/5). Sisa: **6 view (.vue)**: Ceremonial/Glondongan/MesinAbsensi/Pengaduan/StatistikHub/UangPos + wiring `useFeatures`/`useMenus`/`router` (composable `useGlondongan`/`useCeremonial` port juga) | 🟡 **DB+RLS+mapping SELESAI**; view+wiring ⏳ |
| **5. Edge functions** | Port 6 edge fn (`auto-generate-tagihan`, `bmt-webhook`, `dispatch-push`, `get-link-preview`, `hiview-absen`, `reset-user-password`) → tenant-aware | ✅ deploy | ⏳ |
| **6. Cutover** | Resume DB → apply migration → **uji RLS isolasi** → seed tenant `demo` → cutover per-koleksi (Firebase→Supabase), FCM tetap pipa push | ✅ | ⏳ (gated §2) |
| **7. UI/UX + hardening** | Tugas 3: optimisasi tampilan/UX + audit keamanan (RLS lock, PII scope wali, anti self-escalation guru — cermin `guard_guru_self_escalation`, `wali_pii_scope`, `rls_*_lock` Ammu) | sebagian | ⏳ |

---

## 5. FITUR BARU AMMU (delta view — konfirmasi mana masuk paket mana)

| View | Fitur | Usulan paket |
|------|-------|--------------|
| `CeremonialView` | Ceremonial PTPT (upacara/apel) | Pro+ |
| `GlondonganView` | Tes glondongan (kenaikan massal) | Basic+ |
| `MesinAbsensiView` | Kelola mesin fingerprint (Hiview/Fingerspot) | Pro+ (anak `fingerprint`) |
| `PengaduanView` | Pengaduan (+ `wali_pii_scope`) | Pro+ |
| `StatistikHubView` | Hub statistik terpusat | Premium |
| `UangPosView` | Uang pos santri | anak `keuangan` |

+ enhancement di view yang sudah ada (dari git log Ammu): KPI absen personal, bisyaroh
`per_tepat`, libur per-lembaga, grafik kehadiran bulanan, dll.

---

## 6. PRINSIP AMAN

1. **Firebase tetap jalan** selama migrasi (scaffold-first: client null-safe). Nol downtime.
2. **Jangan sentuh repo Ammu** (`Portal MU`) — hanya baca sebagai pola.
3. **Semua langkah file dulu**, live-DB belakangan + review. Migration = reversible (file git);
   apply ke DB berisi data = TIDAK — makanya di-gate.
4. **RLS isolasi = satu-satunya batas antar-lembaga.** Wajib test sebelum data produksi.
5. Commit hanya bila diminta. Kerja di worktree/branch `claude/waseela-resume-sync-b34550`.

---

## 7. STATUS DB LIVE (25 Jul) — project `vfbmaywcjurykxfetbia` (ap-southeast-1)

- **Diterapkan via MCP (10 migration):** foundation+core+keuangan+akademik+konten+auth_login+
  realtime_grants+pengaduan+ptpt_features+**rls_ptpt_lock** → **52 tabel, SEMUA RLS aktif (0 tanpa RLS)**
  + auth RPC + 35 realtime. Adapter client `db.js`+`authSupabase.js`+`supabase.js`+`queryClient.js` (syntax OK, dormant).
- **Tabel fitur baru applied+test:** `pengaduan` (4/4), `tes_glondongan`+`ceremonial_ptpt` + **RLS LOCK PTPT
  (test 5/5)** — PJ/koordinator/pengampu bisa tulis, guru biasa DIBLOK, santri tak baca, cross-tenant diblok.
  Helper PTPT (auth_is_pj_lembaga, auth_is_koordinator_glondongan, auth_is_pengampu_santri, dst) SEMUA tenant-scoped.
- **Pengaduan test LULUS 4/4:** KORLAP auto-flag (trigger `sync_guru_profile_role` tenant-scoped),
  KORLAP + pelapor baca, tenant lain TIDAK baca (isolasi + privasi).
- **`config/plans.js` UPDATE:** mapping paket 6 fitur baru disetujui user — Glondongan(Basic+),
  Ceremonial/MesinAbsensi/Pengaduan(Pro+), StatistikHub(Premium), UangPos(anak Keuangan).
- **RLS isolation test LULUS** (5/5, transaksi rollback — tanpa sisa data uji): no cross-tenant
  read/write; anon (header `x-tenant`) hanya baca data publik tenant-nya; anon tak baca PII santri.
- **Auth login test LULUS** (9/9): `resolve_login` per-tenant (admin/guru/santri, WA→kanonik),
  **cross-tenant login diblok**, `handle_new_user` set tenant+peran dari email `<key>@<slug>.waseela.local`.
- **⚠️ Sisa percobaan lama ditemukan:** skema `app` (tabel duplikat santri/guru/master/settings/tenants
  + helper `app.*` + **JWT hook** `app.custom_access_token_hook` + `app.get_public_branding` + `public.rls_auto_enable`).
  Arsitektur BERBEDA (JWT-claims). **Keputusan: DIBERSIHKAN** (superseded oleh skema public saya).
- **⚠️ Caveat deploy channel:** project ter-connect GitHub `kollepiyah/Waseela`. Migration diterapkan
  via MCP (versi apply-time), BUKAN via push. Kalau nanti file migration di-push ke branch yang
  diwatch Supabase, bisa bentrok "table already exists". Reconcile: treat MCP sbg source-of-truth
  baseline, atau tandai versi sudah-applied sebelum mengaktifkan auto-deploy GitHub.
- **Hardening (Fase 7) — SEBAGIAN SELESAI (30 Jul, `20260730000000_fase7_hardening.sql`):**
  ✅ `search_path=''` dikunci di `set_updated_at`/`_digits`/`_norm_key` (advisor 0011 = 0).
  ✅ REVOKE execute dari public/anon/authenticated utk `handle_new_user`+`sync_guru_profile_role` (fungsi
     TRIGGER) + `_resolve_authkey` (internal-definer) → keluar dari daftar 0028/0029. Diuji: `resolve_login('admin')`
     sebagai anon TETAP jalan; `_resolve_authkey` langsung oleh anon → permission denied.
  ⏳ **SISA (sub-tugas terpisah, security-critical):** 17 helper peran/tenant (`auth_can_*`,`auth_is_*`,
     `current_tenant_id`,`auth_role_sistem`) + `resolve_login` masih ter-expose (0028/0029). JANGAN sekadar
     revoke dari authenticated — dipakai DI DALAM policy+default → query jadi permission denied. Solusi benar =
     pindahkan ke schema privat (`private`) + tulis-ulang rujukan policy/default, LALU re-run test isolasi
     (RLS 5/5, auth 9/9, pengaduan 4/4, PTPT 5/5). Risiko dibiarkan: NIHIL bocor data (fungsi hanya balikin
     status peran/tenant si pemanggil sendiri). `resolve_login` memang sengaja publik (dipanggil anon saat login).
