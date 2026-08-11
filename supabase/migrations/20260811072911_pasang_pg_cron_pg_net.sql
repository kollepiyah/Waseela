-- ============================================================================
-- Ekstensi penjadwalan — pg_cron + pg_net.
--
-- LATAR (audit 11 Agu 2026): `cron.job` tidak ada di database, artinya pg_cron
--   memang belum pernah terpasang. Akibatnya DUA fungsi terjadwal tak pernah
--   berjalan sejak project ini hidup:
--     · dispatch-push          -> notif_queue macet 'pending' (5 baris sejak 9 Agu,
--                                 tak satu pun notifikasi sampai ke HP pengguna)
--     · auto-generate-tagihan  -> tagihan bulanan otomatis tidak pernah terbit
--
--   pg_net dibutuhkan karena pg_cron hanya menjalankan SQL; untuk memanggil Edge
--   Function lewat HTTPS diperlukan `net.http_post`.
--
-- Ekstensi saja BELUM melakukan apa pun. Job dijadwalkan di migrasi terpisah
--   (`20260811170000_jadwal_cron.sql`) yang sengaja MENOLAK jalan sebelum secret
--   tersimpan di Vault — sebab kedua fungsi itu kini gagal-tertutup (A4), jadi
--   menjadwalkannya tanpa secret = job yang menembak dan selalu ditolak 401.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
