-- ============================================================================
-- WASEELA · MT-06 GRANTS + REALTIME publication (port Ammu realtime_grants +
-- realtime_add_master_data). Trigger updated_at TIDAK di-loop di sini (sudah
-- dipasang per-tabel di migration domain).
--
-- Realtime = whitelist (cermin REALTIME set di services/db.js). RLS tetap berlaku
-- untuk broadcast → tiap user hanya terima event baris tenant-nya (isolasi realtime).
-- Tabel fitur incremental (tes_glondongan, ceremonial_ptpt, keuangan_va_intent,
-- pengaduan) ditambahkan ke publication BERSAMA migration-nya (Fase 4).
-- ============================================================================

-- Grants ke role PostgREST (RLS tetap gerbang sebenarnya). service_role bypass RLS.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated, service_role;

-- Realtime publication — whitelist (idempotent: cek dulu supaya aman di-rerun).
do $$
declare t text;
begin
  foreach t in array array[
    'beranda_post','posts','post_reactions','rekap_prestasi','riwayat_prestasi',
    'notif_prestasi','riwayat_kenaikan','tes_kenaikan','user_notif_state','kritik_saran',
    'supervisi_catatan','absensi_guru','keuangan_buku_induk','keuangan_tagihan',
    'pembayaran_transfer_pending','absensi_shift_guru','santri','guru','master','lembaga',
    'settings','izin_guru','rapor_semester','rekap_diniyah','keuangan_gaji',
    'keuangan_hutang_piutang','keuangan_tabungan_santri','keuangan_uang_saku_santri',
    'kegiatan','psb_pendaftaran','absensi_santri_ngaji_bulanan','absensi_santri_sekolah_bulanan'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
