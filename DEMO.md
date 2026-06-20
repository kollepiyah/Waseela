# 🎬 DEMO Waseela — Setup & Deploy

Demo 1-layar dengan **panel toggle fitur** (pojok kanan-bawah): calon pelanggan
nyalakan/matikan modul & lihat app berubah → pilih paket/fitur yang diinginkan.

- **Tanpa Cloud Functions** → cukup Firebase **Spark (gratis)**.
- Pakai project **sandbox** (BUKAN produksi lembaga — data dummy akan diisi).
- Login sebagai **admin** (login guru/santri butuh functions → tak dipakai di demo).

---

## Langkah

### 1. Isi config demo
Buka [`tenants/demo/tenant.config.js`](tenants/demo/tenant.config.js) → isi `firebaseConfig`
dari project sandbox (Console → Project settings → Web app). Field lain sudah terisi
(`demo: true`, `plan: 'premium'`).

### 2. Aktifkan layanan di Firebase Console (project sandbox)
- **Authentication** → Sign-in method → aktifkan **Email/Password**.
- **Firestore Database** → Create database (mode production; region bebas, idealnya `asia-southeast2`).
- **Storage** → Get started (perlu untuk deploy `storage.rules`).
- Biarkan **Spark** (jangan upgrade Blaze — demo tak pakai functions).

### 3. Seed data dummy + akun admin
```bash
npm i firebase-admin            # sekali saja (di root repo)
# Console → Project settings → Service accounts → Generate new private key → simpan:
#   scripts/sa-demo.json   (RAHASIA — sudah di-gitignore)
node scripts/seed-demo.mjs --key scripts/sa-demo.json
# opsional ganti sandi:  --password rahasia123
```
Mengisi: branding + admin (`adminmu` / `demo1234`) + ~3 guru, ~18 santri, tagihan/
pembayaran, prestasi, absensi, 2 postingan. Skrip BYPASS rules (Admin SDK) + set claim
`role=super_admin` (jadi admin bisa menulis tanpa Cloud Function).

### 4. Build config demo
```bash
node scripts/build-tenant.mjs demo
```
Men-set config aktif demo, generate `.firebaserc` (target project sandbox), build `app/dist`.

### 5. Deploy (TANPA functions)
```bash
firebase login            # sekali, bila belum
firebase deploy --only firestore:rules,storage,hosting
```
> JANGAN `--only functions`. `.firebaserc` sudah menarget project sandbox (dari langkah 4).

### 6. Buka & pamerkan
- URL: `https://<projectId-sandbox>.web.app`
- Login: **adminmu / demo1234**
- Klik **🎛️ Mode Demo** (pojok kanan-bawah):
  - Tombol **Basic / Pro / Premium** = terapkan preset paket.
  - Centang per-modul = kustom à la carte.
  - Tiap perubahan → app refresh ~1 detik menampilkan konfigurasi baru.

---

## Catatan
- **Hanya admin** yang bisa login di demo (guru/santri butuh function `findUserByLogin`).
- **App Check** otomatis OFF (env `VITE_APPCHECK_RECAPTCHA_KEY` tak di-set) — tak memblok demo.
- Mau reset demo? Jalankan ulang langkah 3 (idempotent — menimpa data dummy).
- Setelah demo, kembalikan config dev: `node scripts/build-tenant.mjs mambaul-ulum --no-build`.
- Paket & pemetaan fitur didefinisikan di [`app/src/config/plans.js`](app/src/config/plans.js)
  (Basic/Pro/Premium). Edit di sana bila mau ubah isi paket.
