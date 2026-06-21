# Waseela — Template Aplikasi Portal Pesantren (white-label)

Produk white-label portal pesantren & sekolah. Satu kode
bersama (`app/`) + lapisan config per-lembaga (`tenants/`). Tiap lembaga = **project
Firebase terpisah** (isolasi data otomatis) + (opsional) app Android sendiri.

> Arah jangka panjang: pendekatan **B (template build-per-tenant)** ini = on-ramp.
> Saat skala besar, lapisan config yang sama dipakai ulang untuk naik ke **C1
> (multi-tenant, 1 app, 1 project + tenantId)**. Lihat catatan proyek.

## Struktur

```
Waseela/
├── app/                       # SATU kode bersama. JANGAN edit untuk branding.
│   └── src/tenant.config.js   # ACTIVE config — DIGENERATE, jangan edit langsung
├── tenants/
│   ├── _template/             # cetakan: salin ini untuk lembaga baru
│   └── demo/                  # tenant demo (showcase)
│       └── tenant.config.js   # SUMBER KEBENARAN config 1 lembaga
└── scripts/
    └── build-tenant.mjs       # set config aktif + (opsional) build
```

## Pembagian config

| Tipe | Di mana | Contoh |
|---|---|---|
| **Build-time** (tak bisa runtime) | `tenants/<slug>/tenant.config.js` | `firebaseConfig`, `appId`, `appName`, `themeColor` |
| **Runtime** (admin bisa ubah via UI Pengaturan → Firestore `settings/web`) | seed di `branding` + diisi admin | nama lembaga, kop, logo, kontak, channel |
| **Feature-flags** (nyala/mati modul) | `features` di tenant.config | `keuangan`, `psb`, `fingerprint`, dst |

## Tambah lembaga baru

1. `cp -r tenants/_template tenants/<slug>` (mis. `al-falah`).
2. Buat **project Firebase baru** untuk lembaga itu → isi `firebaseConfig`.
3. Isi `appId`, `appName`, `branding`, atur `features`.
4. (opsional) taruh `tenants/<slug>/logo.png`.
5. `node scripts/build-tenant.mjs <slug>` → hasil di `app/dist/`.

## Pengembangan

```bash
cd app
npm install
npm run dev          # pakai tenant aktif terakhir (default: demo)
```

Ganti tenant aktif tanpa build: `node scripts/build-tenant.mjs <slug> --no-build`.

## Catatan

- `app/src/tenant.config.js` di-generate (gitignore disarankan); tenant `demo`
  disertakan agar `npm run dev` jalan langsung.
- Native Android (folder `android/`) belum disertakan — di-generate via
  `npx cap add android` + `npx cap sync` saat menyiapkan build AAB per lembaga
  (appId sudah otomatis dari `capacitor.config.json` yang dipatch build-tenant).
- Skema akademik (rapor/kenaikan/jenjang) = **data-driven** (admin isi via UI
  MasterData/FieldSchema) — untuk lembaga sejenis (Qiraati/Diniyah) tak perlu kode baru.
