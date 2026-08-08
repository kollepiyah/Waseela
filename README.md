# Waseela — Portal Manajemen Lembaga Pendidikan

Aplikasi manajemen pesantren & sekolah: santri, guru, absensi, rapor, keuangan
(syahriyah/POS/tabungan/bisyaroh), kegiatan, dan kanal informasi.
Web + Android + Desktop. Dikembangkan oleh **Bakafrawi Project**.

## Arsitektur

**Single-tenant**: satu pemasangan = satu lembaga = satu project Supabase sendiri.
Isolasi data terjadi di batas project, bukan di baris tabel — sederhana dan tak bisa
bocor antar-lembaga.

| Lapis | Isi |
|---|---|
| Data · Auth · Storage | **Supabase** (41 migrasi + RLS berbasis peran) |
| Notifikasi + Hosting | **Firebase** — FCM & App Check saja, tak menyentuh data lembaga |
| Klien | Vue 3 SPA (`app/`) · Android (Capacitor) · Desktop (Electron) |

```
Waseela/
├── app/
│   ├── src/config/brand.js   # SUMBER TUNGGAL identitas produk & default merek
│   ├── src/                  # Vue 3 SPA
│   ├── android/              # Capacitor (Android)
│   └── electron/             # Desktop
├── brand-assets/             # logo/ikon/splash sumber → disebar apply-brand.mjs
├── supabase/{migrations,functions}
├── tests/unit/               # 67 berkas, ~870 tes
└── scripts/                  # brand, white-label, sync, rilis
```

## Merek: dua lapis yang sengaja dipisah

| Lapis | Isi | Siapa yang mengisi |
|---|---|---|
| **Produk** | nama app, logo, ikon, splash, hak cipta | tetap — Waseela · © Bakafrawi Project |
| **Lembaga** | kop surat 1–4, logo kop, alamat, telp, nama lembaga, motto | **pembeli**, lewat UI Pengaturan (tanpa rebuild) |

Bidang identitas lembaga **dikirim kosong**. Jangan menulis nama lembaga sebagai
literal di komponen — arahkan ke `BRAND.*` supaya gerbang audit tetap bermakna.

## Perintah

```bash
npm test                              # 67 berkas tes
npm run build                         # build web (app/dist)
node scripts/whitelabel.mjs --audit   # gerbang: nol jejak identitas (sumber + hasil build)
node scripts/apply-brand.mjs          # sebar logo/ikon/splash + audit aset
node scripts/sync-from-ammu.mjs --dry # intip fitur baru dari repo hulu
npm run deploy                        # build + firebase deploy hosting
npm run build:apk                     # APK Android (sideload)
npm run build:aab                     # AAB (Play Store)
npm run electron:release              # installer desktop
```

## Sebelum mengirim ke pembeli

Wajib lulus **keduanya** — gerbang teks tak bisa melihat gambar:

```bash
node scripts/whitelabel.mjs --audit
node scripts/apply-brand.mjs
```

Langkah provisioning lengkap: [`RUNBOOK-PEMBELI.md`](RUNBOOK-PEMBELI.md).

## Menyusul fitur baru dari hulu

Arsitektur Waseela identik dengan repo hulu, jadi sync = salin + terapkan ulang aturan
white-label. **Repo hulu hanya dibaca**, tak pernah ditulis.

```bash
node scripts/sync-from-ammu.mjs --dry   # lihat dulu
node scripts/sync-from-ammu.mjs         # salin + white-label + gerbang + tes
```

Kalau gerbang gagal, tambahkan aturannya di `scripts/whitelabel-rules.mjs` —
**jangan menambal berkasnya langsung**, tambalan itu hilang di sync berikutnya.
