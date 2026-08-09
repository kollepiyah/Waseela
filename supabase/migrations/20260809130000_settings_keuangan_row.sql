-- ============================================================================
-- Pastikan baris `settings/keuangan` ADA, walau di pemasangan yang benar-benar baru.
--
-- MASALAHNYA (ketahuan 9 Agu 2026, sesudah aplikasi dipakai):
--   `20260729130000_settings_keuangan_key.sql` memindahkan kunci keuangan sensitif
--   dari `settings/general` ke baris `settings/keuangan` — tapi hanya `if g is not
--   null`, yaitu HANYA kalau `general` sudah ada saat migrasi dijalankan.
--   Di project baru, migrasi berjalan pada DB kosong: `general` belum ada, jadi baris
--   `keuangan` TAK PERNAH DIBUAT.
--
--   Akibatnya di layar Pengaturan Keuangan muncul peringatan merah
--   "Config keuangan TIDAK terbaca dari server" dan penyimpanan DIKUNCI. Itu perilaku
--   yang benar — store membedakan "baris tak terbaca" dari "baris kosong", dan menolak
--   menimpa config yang mungkin ada. Yang salah cuma: barisnya memang tak pernah lahir.
--
--   Sepola dengan bucket storage (20260809120000): migrasi warisan mengandaikan data
--   yang sudah ada di project lama, sehingga tak jalan di project baru.
--
-- Baris kosong sudah cukup: store hanya perlu membedakan null (tak terbaca) dari objek.
-- ============================================================================
insert into public.settings (key, value)
values ('keuangan', '{}'::jsonb)
on conflict (key) do nothing;
