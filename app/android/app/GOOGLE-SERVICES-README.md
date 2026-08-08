# `google-services.json` WAJIB DIISI SEBELUM BUILD ANDROID

Berkas ini **sengaja tidak ada** di repo. Yang sebelumnya terbawa dari repo asal
menunjuk project Firebase lembaga lain — memakainya berarti notifikasi pembeli
mengalir ke project orang lain, sekaligus membocorkan identitas.

## Cara mendapatkannya

1. Firebase Console → project **Waseela** (atau project milik pembeli).
2. Project settings → *Your apps* → **Add app → Android**.
3. Isi *Android package name* **PERSIS**: `id.waseela.app`
   (harus sama dengan `applicationId` & `namespace` di `app/build.gradle`).
4. Unduh `google-services.json`, taruh di folder ini (`app/android/app/`).

## Kalau belum ada

Gradle akan gagal dengan pesan dari plugin `com.google.gms.google-services`.
Itu memang disengaja — lebih baik gagal jelas daripada terkirim memakai project
yang salah.

Catatan: Firebase di sini **hanya** untuk FCM (notifikasi) + App Check.
Data, auth, dan storage semuanya di Supabase.
