# 🤝 HANDOVER — Waseela

> Untuk sesi/dev berikutnya: baca ini dulu, lalu [`RUNBOOK-PEMBELI.md`](RUNBOOK-PEMBELI.md).
> Terakhir diperbarui: **8 Agu 2026** — re-fork ke single-tenant + white-label penuh.

---

## ‼️ Cara berkomunikasi (jangan dilewat)

- **Panggil beliau "Kyai"** — bukan "akhi", "user", "saudara", atau "Anda". Konvensi ini
  sudah lama berlaku di repo Ammu (`docs/archive/PROMPT-NEXT-CHAT.md`) tapi sempat tak
  ikut ke repo Waseela; jangan ulangi.
- Bahasa Indonesia sederhana, mudah difahami.
- **Diskusikan langkahnya dulu sebelum eksekusi** — minimal satu putaran konfirmasi.
- Beliau developer berpengalaman, bukan pemula — jangan menjelaskan terlalu remedial.

---

## TL;DR

**Waseela** = produk portal manajemen lembaga pendidikan milik **Bakafrawi Project**,
diturunkan dari repo hulu **Ammu Online** (`D:\Aplikasi Project\Portal MU`).

- **Single-tenant**: 1 pemasangan = 1 lembaga = 1 project Supabase sendiri.
- **Backend**: Supabase (data/auth/storage). Firebase tinggal FCM + App Check + Hosting.
- **Klien**: Vue 3 SPA + Android (Capacitor) + Desktop (Electron).
- **Status**: kode SIAP — tes 867 hijau, build hijau, gerbang white-label lulus
  (sumber + hasil build). Sisa = provisioning yang butuh akun (lihat RUNBOOK).

---

## Sejarah singkat & kenapa bentuknya begini

Waseela awalnya (Jun 2026) di-fork dari Ammu sebagai **SaaS multi-tenant** berbasis
Firebase: `tenants/` + build-per-tenant, paket Basic/Pro/Premium, panel demo, konsol
super-admin, dan skema Supabase multi-tenant (52 tabel ber-`tenant_id` + RLS, teruji).

**8 Agu 2026 — pivot.** Muncul satu pembeli, dan dua kenyataan bertemu:

1. Hulu sudah maju **354 commit** sejak fork, termasuk **35 modul util baru**
   (syahriyah, tagihan, kasLembaga, bebanMengajar, simulasiBisyaroh, shiftDerive, …).
2. Backend sudah bercabang: hulu **Supabase-native**, Waseela masih **Firebase-first**.
   Cherry-pick per fitur = menulis ulang tiap fitur melintasi beda backend.

Keputusan: **re-fork** dari hulu terkini + **collapse ke single-tenant**. Karena hulu
memang single-tenant, arsitektur Waseela jadi identik dengannya — sehingga sync
berikutnya cukup salin + terapkan ulang aturan, bukan proyek re-arsitektur.

Kerja multi-tenant **tidak hilang**: tag **`arsip/multitenant-v1`** (commit `3465131`).
Basis re-fork = hulu commit **`e255c5d`** (8 Agu 2026).

---

## Keputusan kunci

| Topik | Keputusan | Alasan |
|---|---|---|
| Tenancy | **Single-tenant**, 1 project Supabase per lembaga | Isolasi di batas project — tak bisa bocor antar-lembaga; sync hulu jadi murah selamanya |
| Sync hulu | **Re-fork**, bukan cherry-pick | 354 commit + beda backend membuat port per-fitur = tulis ulang |
| Gating paket | **Dibuang** | Pembeli tunggal; `plans.js`/`useFeatures` hanya menambah beban sync |
| Panel demo & konsol super-admin | **Dibuang** | Ikut model SaaS yang ditinggalkan |
| Merek aplikasi | **Tetap Waseela**, hak cipta Bakafrawi Project | Pembeli tak mengganti merek app — hanya mengisi identitas lembaganya di kop |
| Identitas lembaga | **Runtime**, lewat UI Pengaturan | Pembeli mengisi sendiri, tanpa rebuild |
| Repo hulu | **BACA-SAJA, selamanya** | Tak ada tulis/hapus/git di `Portal MU`; `sync-from-ammu.mjs` satu arah |

---

## Peta kode

```
app/src/config/brand.js    # SUMBER TUNGGAL identitas produk + default merek + FIREBASE_CONFIG
app/src/stores/settings.js # DEFAULT_SETTINGS ← BRAND; watch → setKopImage
app/src/utils/kopMuassis.js# kop baris-1 config-driven (settings.kopImageUrl)
scripts/whitelabel-rules.mjs # aturan transformasi hulu → Waseela (SATU sumber)
scripts/whitelabel.mjs       # terapkan + GERBANG audit (sumber & hasil build)
scripts/apply-brand.mjs      # sebar aset gambar + audit aset
scripts/sync-from-ammu.mjs   # tarik fitur baru, satu arah
scripts/.sync-baseline.json  # sidik jari hulu saat sync terakhir
brand-assets/                # logo/ikon/splash sumber
```

---

## Yang HARUS dipahami sebelum menyentuh white-label

**Bentuk kebocoran di kode hulu adalah _fallback_, bukan teks biasa:**

```js
settings.kopLine1 || 'YAYASAN MAMBAUL ULUM'
settings.namaLembaga || 'Pondok Pesantren Mambaul Ulum'
```

Fallback hanya muncul saat baris settings pembeli **masih kosong** — persis hari pertama
pemakaian, dan justru saat itulah kop pertama dicetak. Semuanya sudah diarahkan ke
`BRAND.*`, dan dikunci tes `tests/unit/whiteLabelBrand.test.js`.

**Titik paling berisiko: `muassis.png`** — kaligrafi lembaga hulu yang dulu ter-hardcode
di 9 berkas. Sekarang config-driven (`settings.kopImageUrl`, kosong = fallback teks).
Ini **gambar**, jadi grep tak akan pernah menangkapnya. `sync-from-ammu.mjs`
sengaja tak pernah menarik `kopMuassis.js` maupun `muassis.png`.

**Aturan main:** kalau sync membawa literal identitas baru, tambahkan aturannya di
`scripts/whitelabel-rules.mjs` — **jangan menambal berkasnya langsung**, tambalan itu
hilang di sync berikutnya. Gerbang akan menolak sampai aturannya ada.

---

## Perubahan identifier (DB pembeli bersih → aman)

| Lama (hulu) | Baru | Dipakai di |
|---|---|---|
| `@ammu.local` | `@waseela.local` | authSupabase + 3 migrasi + 2 edge fn |
| `mu_auth_` | `wsl_auth_` | padding sandi: klien + 2 edge fn + tes |
| `ammu_provisioned` | `waseela_provisioned` | `app_metadata` — **gerbang trigger**, wajib serempak |
| `ammu-*` (CSS) | `wsl-*` | ribbon.css dkk |
| `ammu_*` / `portalMu_*` | `waseela_*` | kunci localStorage, SharedPreferences |
| `app.ammu.id` | `id.waseela.app` | applicationId, namespace, paket Java |
| `ic_stat_ammu` | `ic_stat_waseela` | drawable + manifest + capacitor config |

---

## Sisa pekerjaan

Semuanya butuh akun/aset — tak bisa diselesaikan dari repo. Detail di **RUNBOOK-PEMBELI.md**.

1. **Aset persegi**: `brand-assets/{icon,splash,ic_stat}.png`. `apply-brand.mjs` masih
   melaporkan 4 berkas identik dengan hulu (ikon Android/Electron & splash).
2. **Supabase pembeli**: project baru → 41 migrasi → edge functions + secret → Auth config.
3. **Firebase pembeli**: `google-services.json` untuk paket `id.waseela.app`.
4. **Data awal**: seed lembaga/kelas, akun `admin`, impor data lama lewat menu Impor Supabase.
5. **Keystore Android BARU** — simpan baik-baik; hilang = tak bisa update selamanya.

---

## Jebakan yang sudah pernah memakan waktu

- **Supabase → Exposed schemas** memuat schema hantu → PostgREST `PGRST002` permanen.
  Restart tak menyembuhkan; ini konfigurasi.
- **Supabase → Auth Hooks** menyisakan `custom_access_token_hook` yatim → login 500.
- **Variabel lingkungan OS basi** menang atas `.env.local` → app menunjuk project lama.
- **Akhir baris**: repo ini LF (`.gitattributes`). Hulu campur CRLF/LF; `sync-from-ammu.mjs`
  menormalkan agar beda akhir-baris tak pernah tampil sebagai "berubah".
- **`google-services.json`** sengaja tak ada di repo. Build Android gagal tanpa itu —
  disengaja, lebih baik daripada terkirim memakai project lembaga lain.
