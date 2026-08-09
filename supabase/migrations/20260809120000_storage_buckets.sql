-- ============================================================================
-- Bucket storage — DIBUAT DI SINI, bukan lewat Dashboard.
--
-- MASALAHNYA (ketahuan 9 Agu 2026, sesudah aplikasi tayang):
--   `20260622092000_storage_policies.sql` membuat POLICY untuk bucket photo/psb/
--   branding, tapi tak pernah membuat bucket-nya — di repo asal ketiganya dibuat
--   manual lewat Dashboard, jadi tak ikut tercatat sebagai migrasi. Akibatnya di
--   project yang baru: policy ada, bucket tidak, dan setiap gambar gagal dengan
--   `400` tanpa penjelasan apa pun di layar.
--
--   Efeknya diam-diam: unggah logo/foto tampak jalan lalu gambarnya tak pernah
--   muncul. Karena itu dibuat lewat migrasi — supaya pemasangan berikutnya tak
--   mengulang penelusuran yang sama.
--
-- ROUTING-nya di app/src/services/storage.js `_bucketFor()`:
--   profil_foto|tanda_tangan|beranda_post|post|foto     -> photo
--   pembayaran_transfer|psb|lembaga/|dokumen            -> psb
--   selebihnya (app_logos, lembaga_logos, kop, bg…)     -> branding
--
-- PUBLIC = true mengikuti perilaku repo asal: gambar ditampilkan lewat URL publik,
--   tanpa signed URL. Menutupnya sekarang akan membuat semua gambar berhenti tampil.
--   ⚠ Konsekuensinya bukti transfer di bucket `psb` bisa dibuka siapa pun yang
--     memegang URL-nya. Menulis (insert/update/delete) tetap dijaga RLS:
--     hanya `authenticated`, dan `branding` khusus auth_can_manage().
--     Kalau kelak ingin privat, ubah bareng `_bucketFor` + pemakaian signed URL.
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('photo', 'photo', true),
  ('branding', 'branding', true),
  ('psb', 'psb', true)
on conflict (id) do nothing;
