-- ============================================================================
-- PERBAIKAN — `akun_provisi_izin` tak pernah diberi hak ke `service_role`.
--
-- GEJALA (dilaporkan Kyai 11 Agu 2026, saat menekan "Buat akun yang belum ada"):
--   Gagal membuat akun: izin-gagal: permission denied for table akun_provisi_izin
--
-- SEBAB: `20260803140000_provisi_izin.sql` membuat tabel ini lalu menjalankan
--   `revoke all on table public.akun_provisi_izin from anon, authenticated;`
--   — benar — TAPI tak pernah `grant` apa pun ke `service_role`. Tabel ini lahir
--   tanpa hak service_role (tabel lain di project punya: santri, guru,
--   notif_queue, settings semuanya DELETE/INSERT/SELECT/UPDATE untuk service_role).
--
--   Edge Function `provision-akun` memakai klien SERVICE-ROLE untuk dua tulisan
--   ke tabel ini — menyapu izin kedaluwarsa (`delete`) dan menerbitkan izin baru
--   (`upsert`) — sehingga langkah itu SELALU gagal sejak tabel dibuat. Karena
--   `izinErr` langsung `return` 500, seluruh sapuan akun ikut berhenti.
--
-- ⚠️ BUKAN masalah RLS. `service_role` ber-`rolbypassrls = true`, jadi RLS aktif
--   tanpa policy (yang memang disengaja: tabel ini server-only) tak menghalanginya.
--   Yang menghalangi murni GRANT tingkat tabel. Menambah policy TIDAK akan
--   menyembuhkan — jangan tergoda ke sana.
--
-- ⚠️ JUGA BUKAN akibat `20260811120000_rpc_internal_cabut_publik.sql`. Migrasi itu
--   hanya mencabut EXECUTE pada FUNGSI (termasuk `_provisi_diizinkan`), tak pernah
--   menyentuh hak tabel — dan `_provisi_diizinkan` sudah di-grant ulang ke
--   service_role di sana.
--
-- Hak diberikan SEPERLUNYA saja (bukan `all`): select/insert/update/delete —
--   persis yang dipakai delete + upsert. anon & authenticated TETAP nol; tabel ini
--   adalah gerbang pembuatan akun berperan, tak boleh tersentuh klien.
-- ============================================================================

grant select, insert, update, delete
  on table public.akun_provisi_izin
  to service_role;

-- Tegaskan ulang: klien tak boleh menyentuh tabel ini sama sekali.
revoke all on table public.akun_provisi_izin from anon, authenticated;
