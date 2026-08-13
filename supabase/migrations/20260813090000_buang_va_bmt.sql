-- ============================================================================
-- Buang jalur pembayaran VIRTUAL ACCOUNT (BMT) — keputusan Kyai, 13 Agu 2026.
--
-- KENAPA: fitur ini warisan repo hulu, terikat pada satu BMT tertentu milik lembaga
--   di sana. Lembaga pembeli tak memakainya, dan integrasinya memang tak pernah
--   hidup (`bmt_aktif` selalu OFF, Edge Function `bmt-webhook` tak pernah ikut
--   di-deploy). Kodenya di aplikasi sudah dibuang di v.1.0.1; migrasi ini menutup
--   sisa permukaannya di database.
--
-- KENAPA MENGHAPUS, BUKAN MEMBIARKAN: `apply_bmt_payment` itu SECURITY DEFINER —
--   ia menembus RLS lalu menulis ke tagihan, uang saku, dan buku induk. Fungsi
--   sekuat itu tak pantas tinggal sebagai barang tak terpakai. (Hak EXECUTE-nya
--   memang sudah dicabut dari anon/authenticated, tapi yang paling aman dari
--   penyalahgunaan adalah yang tidak ada.)
--
-- KEHILANGAN DATA: keduanya kosong di pemasangan ini — VA tak pernah diaktifkan,
--   jadi tak ada niat-bayar maupun laporan masuk yang tersimpan. Kalau suatu saat
--   dipasang di DB yang TERLANJUR berisi, jalankan cadangan dulu; DROP di bawah
--   tidak memeriksa isi.
--
-- Yang TIDAK disentuh: keuangan_uang_saku_santri & keuangan_tabungan_santri (lahir
--   di migrasi 20260622090200, berdiri sendiri) dan seluruh riwayat buku induk.
-- ============================================================================

-- Realtime: cabut dulu, kalau tidak publication menyimpan rujukan ke tabel hantu.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'keuangan_va_intent'
  ) then
    execute 'alter publication supabase_realtime drop table public.keuangan_va_intent';
  end if;
end $$;

-- RPC penerap pembayaran VA (didefinisikan 20260629110000, ditulis ulang 20260715120000).
drop function if exists public.apply_bmt_payment(text, bigint, text, jsonb);

-- Tabel + policy + index ikut terbawa DROP TABLE.
drop table if exists public.keuangan_va_inbox;
drop table if exists public.keuangan_va_intent;
