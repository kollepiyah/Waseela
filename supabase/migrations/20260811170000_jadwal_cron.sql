-- ============================================================================
-- Jadwal cron — dispatch-push (tiap menit) + auto-generate-tagihan (harian).
--
-- ⚠️ PRASYARAT (migrasi ini MENOLAK jalan bila belum terpenuhi):
--   1. Secret tersimpan di Vault dengan nama `cron_secret`:
--        select vault.create_secret('<NILAI-RAHASIA>', 'cron_secret',
--          'Secret pemanggil Edge Function cron');
--   2. NILAI YANG SAMA dipasang di Supabase → Edge Functions → Secrets
--      sebagai `CRON_SECRET`.
--   3. Kedua fungsi sudah di-deploy ulang dengan kode gagal-tertutup (A4).
--
--   Kalau (1) dilewati, migrasi berhenti dengan pesan jelas — sengaja, supaya
--   tak lahir job yang tiap menit menembak dan selalu ditolak 401.
--   Kalau (2) dilewati, job jalan tapi fungsi menolak semua (lihat cron.job_run_details).
--
-- KENAPA SECRET DIBACA DARI VAULT, BUKAN DITULIS DI PERINTAH JOB:
--   `cron.job.command` terbaca siapa pun yang bisa SELECT tabel itu, dan ikut
--   ter-dump saat backup. Vault menyimpannya terenkripsi; job hanya menyebut
--   NAMA-nya, nilainya dibaca saat job berjalan. Jadi rahasianya tak pernah
--   mendarat sebagai teks polos di skema — termasuk di repo ini.
--
-- WAKTU: DB ber-timezone UTC, pg_cron menjadwal dalam UTC, lembaga di WIB (UTC+7).
--   `0 17 * * *` UTC = 00.00 WIB. auto-generate-tagihan menghitung sendiri
--   periodenya dalam Asia/Jakarta (index.ts:109), jadi hasilnya benar terlepas
--   dari jam cron — penjadwalan tengah malam WIB hanya membuat tagihan bulan baru
--   terbit sedini mungkin di tanggal 1.
--
-- IDEMPOTEN: job lama ber-nama sama dibuang dulu, jadi migrasi ini aman diulang.
--
-- ⚠️ HEADER: memakai `Authorization: Bearer <secret>`, BUKAN header kustom.
--   Versi pertama berkas ini memakai `x-cron-secret` dan SELALU ditolak 401 —
--   header kustom tersaring di perjalanan pg_net -> gerbang Edge Function,
--   sementara nilai secret-nya sendiri sudah benar. Terbukti 11 Agu 2026 dan
--   diperbaiki di `20260811091039_jadwal_cron_header_authorization.sql`; berkas
--   ini diselaraskan agar keadaan akhirnya sama, sehingga urutan jalan kedua
--   migrasi tak berpengaruh (di project baru '091039' justru lebih dulu).
--   `?k=<secret>` juga diterima fungsi, tapi JANGAN dipakai: URL lengkap tercetak
--   di log permintaan Edge Function, jadi rahasianya akan mendarat di log.
-- ============================================================================

-- ---- Gerbang prasyarat ------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'cron_secret') then
    raise exception
      'Vault secret `cron_secret` belum ada. Buat dulu: '
      'select vault.create_secret(''<NILAI>'', ''cron_secret'', ''Secret cron''); '
      'lalu pasang NILAI YANG SAMA sebagai CRON_SECRET di Edge Functions → Secrets.';
  end if;
end $$;

-- ---- dispatch-push — tiap menit --------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'waseela-dispatch-push') then
    perform cron.unschedule('waseela-dispatch-push');
  end if;
end $$;

select cron.schedule(
  'waseela-dispatch-push',
  '* * * * *',
  $job$
  select net.http_post(
    url     := 'https://vfbmaywcjurykxfetbia.supabase.co/functions/v1/dispatch-push',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret
                                                  from vault.decrypted_secrets
                                                 where name = 'cron_secret')
               ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- ---- auto-generate-tagihan — harian, 00.00 WIB -----------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'waseela-auto-tagihan') then
    perform cron.unschedule('waseela-auto-tagihan');
  end if;
end $$;

select cron.schedule(
  'waseela-auto-tagihan',
  '0 17 * * *',
  $job$
  select net.http_post(
    url     := 'https://vfbmaywcjurykxfetbia.supabase.co/functions/v1/auto-generate-tagihan',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret
                                                  from vault.decrypted_secrets
                                                 where name = 'cron_secret')
               ),
    timeout_milliseconds := 60000
  );
  $job$
);
