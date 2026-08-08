# brand-assets — sumber identitas visual Waseela

`scripts/apply-brand.mjs` membaca folder ini lalu menyebarkannya ke seluruh titik
build (web, PWA, Android, Electron). Aset di sini adalah **satu-satunya** sumber
gambar merek — jangan menaruh logo langsung di `app/public/` atau `app/resources/`,
karena akan tertimpa saat sync berikutnya.

| Berkas | Wajib | Spesifikasi | Dipakai untuk |
|---|:---:|---|---|
| `logo.png` | ✅ | bebas rasio (dipakai apa adanya) | logo web, ikon PWA 192/512, apple-touch-icon |
| `icon.png` | ✅ | **PERSEGI 1024×1024** | ikon aplikasi Android & Electron |
| `splash.png` | ✅ | **PERSEGI 2732×2732** | splash screen Android & Electron |
| `ic_stat.png` | ⬜ | 96×96, **silhouette putih** latar transparan | ikon kecil notifikasi di status bar Android |

## Kenapa harus persegi

Ikon aplikasi native dipotong jadi persegi/bulat oleh sistem. Logo lanskap
(mis. wordmark 560×312) akan terpotong atau tampil gepeng. Buat versi persegi
tersendiri: lambang saja di tengah, beri ruang kosong ±10% di tepi.

## Sesudah mengisi

```bash
node scripts/apply-brand.mjs
cd app && npx capacitor-assets generate --android
```

Perintah kedua meregenerasi ikon launcher + splash Android dari `app/resources/`.
