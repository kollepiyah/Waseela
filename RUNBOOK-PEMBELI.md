# Runbook — menyiapkan Waseela untuk satu pembeli

Kode sudah siap (single-tenant, white-label bersih, tes hijau). Yang tersisa adalah
langkah yang **butuh akun & keputusanmu** — tak bisa dikerjakan dari repo saja.

Urutan di bawah sengaja: aset → backend → data → rilis. Melompati urutan biasanya
berakhir dengan build yang gagal di tengah jalan.

---

## 0. Aset merek — ✅ SELESAI

`node scripts/apply-brand.mjs` melaporkan **"Semua aset merek terpasang"**.

Logo Waseela (`waseela.png` 560×312) berformat lanskap, sedangkan ikon aplikasi wajib
persegi — `scripts/make-icons.mjs` menyusunnya di kanvas persegi. Kalau nanti ada desain
ikon final dari desainer, cukup timpa `brand-assets/icon.png` lalu:

```bash
node scripts/apply-brand.mjs
cd app && npx @capacitor/assets generate --android
```

`apply-brand.mjs` keluar dengan kode ≠ 0 selama ada aset yang masih byte-identik dengan
repo hulu. Itu disengaja — jangan rilis sebelum bersih.

---

## 1. Supabase — project `vfbmaywcjurykxfetbia`

**Status:** skema multi-tenant lama + seed demo sudah **di-reset** (8 Agu 2026).
Schema `public` kosong, `private` dibuang, `auth.users` kosong, catatan migrasi kosong.
Publication `supabase_realtime` dipertahankan (migrasi hanya `alter`, bukan `create`).

> **⚠ Schema `app` masih dipakai — JANGAN di-drop dulu.** Diperiksa 8 Agu 2026:
> Dashboard → Auth → Hooks masih **ENABLED** menunjuk `app.custom_access_token_hook`.
> Men-drop fungsi/schema itu selagi hook aktif = **login gagal 500 seketika**
> (persis kejadian Juli lalu). Hook itu peninggalan rancangan multi-tenant berbasis
> klaim JWT yang sudah ditinggalkan — di single-tenant, peran ditegakkan RLS lewat
> tabel `profiles`, bukan klaim token. Isinya sudah no-op (`select event`).
>
> **Urutan membersihkannya (jangan dibalik):**
> 1. Dashboard → Auth → Hooks → menu ⋮ pada *Customize Access Token (JWT) Claims* →
>    **Disable**, lalu hapus.
> 2. Dashboard → Settings → API → **Exposed schemas** → buang `app` bila masih ter-list.
>    (Dulu `app` ter-list padahal schema-nya tak ada → PostgREST `PGRST002` permanen;
>    restart tak menyembuhkan karena ini konfigurasi.)
> 3. Baru: `drop function if exists app.custom_access_token_hook(jsonb); drop schema if exists app;`
> 4. Uji login sekali untuk memastikan token tetap terbit normal.

### 1a. Terapkan 41 migrasi

CLI sudah ter-login dan project sudah ter-link. `config.toml` sudah dikunci ke ref yang
benar (sempat menunjuk DB produksi hulu — sudah diperbaiki).

```bash
cd "D:/Aplikasi Project/Waseela" && npx supabase db push --yes
```

Verifikasi: `npx supabase migration list` → kolom `remote` terisi untuk 41 baris.

### 1b. Edge functions

Perhatikan flag-nya — mencerminkan konvensi hulu:

```bash
npx supabase functions deploy reset-user-password
npx supabase functions deploy provision-akun
npx supabase functions deploy get-link-preview      --no-verify-jwt
npx supabase functions deploy dispatch-push         --no-verify-jwt
npx supabase functions deploy auto-generate-tagihan --no-verify-jwt
npx supabase functions deploy hiview-absen          --no-verify-jwt
```

`--no-verify-jwt` = dipanggil pg_cron/anon, bukan sesi user; keamanannya dari
service-role internal. `reset-user-password` SENGAJA tanpa flag karena ia memverifikasi
JWT super_admin.

### 1c. Secret — ⚠ jebakan Windows

```powershell
$json = Get-Content -Raw .\service-account.json | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10
Set-Content -Path .cm.env -Value "FCM_SERVICE_ACCOUNT=$json" -NoNewline -Encoding utf8
npx supabase secrets set --env-file .cm.env
Remove-Item .cm.env   # berisi kunci privat Firebase — jangan ditinggal
```

**JANGAN pakai `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat ...)"` gaya bash di
PowerShell.** `$(cat ...)` tak dieksekusi PowerShell → yang tersimpan bukan JSON sah,
dan `dispatch-push` membalas `500 FCM_SERVICE_ACCOUNT invalid` di SETIAP run cron.
Ini sudah pernah memakan waktu di repo hulu (21 Jul 2026). JSON juga wajib dipadatkan
satu baris — `private_key` penuh newline yang merusak nilai env.

Opsional: `HIVIEW_PUSH_SECRET` (webhook mesin absensi), `IFRAMELY_KEY` (pratinjau link).
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia —
tak perlu di-set.

### 1d. Ekstensi + Vault + cron

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://vfbmaywcjurykxfetbia.supabase.co', 'project_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```

Jadwal (mengikuti hulu): `dispatch-push` tiap menit · `auto-generate-tagihan` 01:00 WIB
(18:00 UTC) · `cleanup_audit_log` 02:00 WIB (19:00 UTC). Pola `cron.schedule` +
`net.http_post` lengkap ada di `docs/SUPABASE-EDGE-FUNCTIONS-DEPLOY.md` repo hulu §5.

Verifikasi tanpa mengirim notifikasi — tunggu 1 menit lalu:

```sql
select status_code, content::text from net._http_response order by created desc limit 3;
```
Cari `200 {"ok":true,"processed":0}`.

### 1e. Auth & konfigurasi dashboard

- Auth → Providers: **Email = Enabled**, **Confirm email = OFF**
  (domain `@waseela.local` tak bisa menerima surel).
- Auth → **Hooks: pastikan KOSONG.** Hook `custom_access_token_hook` yatim membuat
  **login gagal 500** tanpa pesan jelas.
- Settings → API → **Exposed schemas**: jangan me-list schema yang tak ada.

Isi `app/.env.local`:

```
VITE_SUPABASE_URL=https://vfbmaywcjurykxfetbia.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
VITE_APPCHECK_RECAPTCHA_KEY=
```

> Kalau nilai yang terbaca app tak sesuai `.env.local`, curigai variabel lingkungan
> OS/terminal yang basi — pernah terjadi dan menang atas `.env.local`. Restart terminal.

---

## 2. Firebase (notifikasi + hosting)

Firebase di sini **hanya** pipa notifikasi + App Check. Tak menyimpan data lembaga.

1. Project Firebase untuk pembeli (atau pakai `waseela-id` bila satu kanal cukup).
2. Add app → **Android**, package name **`id.waseela.app`** (harus sama persis dengan
   `applicationId` di `app/android/app/build.gradle`).
3. Unduh `google-services.json` → taruh di `app/android/app/`.
   Berkas ini sengaja tidak ada di repo — lihat `app/android/app/GOOGLE-SERVICES-README.md`.
   Tanpa itu build Android gagal; itu disengaja, lebih baik daripada terkirim memakai
   project lembaga lain.
4. Kalau project Firebase berbeda dari bawaan, samakan **dua** tempat:
   `app/src/config/brand.js` → `FIREBASE_CONFIG`, dan `app/public/firebase-messaging-sw.js`.
5. **Notifikasi web push (VAPID)** — Project settings → Cloud Messaging →
   *Web Push certificates* → **Generate key pair**, salin ke `VAPID_KEY` di
   `app/src/config/brand.js`.

   > Kunci ini WAJIB dari project yang sama dengan `FIREBASE_CONFIG`. Kunci milik
   > project lain ditolak `401 token-subscribe-failed` dengan pesan menyesatkan
   > ("missing required authentication credential") — terdengar seperti soal izin,
   > padahal kuncinya sekadar bukan milik project ini. Sudah pernah terjadi 8 Agu 2026.
   >
   > Dikosongkan = web push mati dengan tenang, tanpa galat merah. Notifikasi di
   > aplikasi Android (FCM native) TIDAK terpengaruh — itu jalur terpisah lewat
   > `google-services.json`.

---

## 3. Data awal

1. **Lembaga & kelas** — seed dari `DEFAULT_LEMBAGA_SEED` di
   `app/src/composables/useLembaga.js`. Label tetap **BARE** (`Level 1`, bukan
   `Level 1 (½ Juz)`). Sesuaikan bila struktur lembaga pembeli berbeda.
2. **Akun admin pertama** — username `admin`, lewat RPC `provision_akun` / edge function.
3. **Impor data lama pembeli** — pakai importer bawaan: menu **Impor Supabase**
   (`ImporSupabaseView`). Jangan menulis skrip migrasi baru.

---

## 4. Identitas lembaga (dikerjakan PEMBELI, bukan kita)

Login sebagai admin → **Pengaturan**:

- **Kop Surat**: baris 1–4, alamat, telepon
- **Logo & Background**: 6 slot unggah — Logo Aplikasi, **Logo KOP Surat**, Logo Qiraati,
  background layar
- **Nama lembaga**, motto (tampil di layar login), nama kanal informasi

Semua tersimpan di DB dan langsung berlaku **tanpa rebuild**. Sebelum diisi, kop
tercetak kosong — bukan nama lembaga lain. Itu memang perilaku yang diinginkan.

---

## 5. Rilis

### Web
Hosting tetap di site **`waseela`** (project Firebase `waseela-id`) — sudah tersetel di
`.firebaserc` (`hosting:main` → `waseela`) dan `firebase.json` (`public` → `app/dist`).

```bash
npm run deploy          # build + firebase deploy --only hosting:main
```

### Android
- **Keystore BARU** untuk Waseela — jangan pakai keystore repo hulu (identitas app
  berbeda). Simpan baik-baik: **kehilangan keystore = tak bisa lagi mengirim update**
  ke pengguna yang sudah memasang.
- Isi `app/android/key.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`).
- `npm run build:apk` (sideload) atau `npm run build:aab` (Play Store).
- Perbarui `app/public/app-version.json` (`versionCode`, `versionName`, `apkUrl`) setiap
  rilis — berkas inilah yang dibaca app untuk menawarkan pembaruan.

### Desktop
```bash
npm run electron:release
```

### Selaraskan versi di 4 tempat
`app/src/config/brand.js` (`BRAND.version`) · `app/package.json` ·
`app/android/app/build.gradle` (`versionCode`/`versionName`) · `app/public/app-version.json`.

---

## 6. Cek terakhir sebelum kirim

```bash
npm test                              # 67 berkas, ~870 tes
npm run build
node scripts/whitelabel.mjs --audit   # sumber + hasil build
node scripts/apply-brand.mjs          # aset gambar
```

Lalu di aplikasi yang sudah jalan:

1. Login `admin` → dashboard termuat, data dari Supabase.
2. **Cetak struk POS, rapor, dan rekap prestasi sebelum kop diisi** — tak boleh muncul
   identitas lembaga mana pun. Ini menangkap kebocoran gambar yang tak terlihat grep.
3. Isi kop + unggah logo → cetak ulang → identitas pembeli muncul, tanpa rebuild.
4. Guru biasa tak bisa menulis data terkunci (PTPT/keuangan); santri tak bisa membaca
   PII wali.
5. Android: pasang APK, login, cek tawaran pembaruan membaca `app-version.json` milik kita.
