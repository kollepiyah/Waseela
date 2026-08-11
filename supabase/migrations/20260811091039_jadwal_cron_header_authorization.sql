-- ============================================================================
-- PERBAIKAN jadwal cron — pindah dari header `x-cron-secret` ke `Authorization`.
--
-- GEJALA (11 Agu 2026): sesudah `20260811170000_jadwal_cron.sql` dijadwalkan,
--   dispatch-push membalas 401 {"ok":false,"error":"unauthorized"} enam kali
--   berturut-turut. Itu balasan fungsi KITA SENDIRI (dispatch-push/index.ts:170),
--   jadi permintaan memang SAMPAI — gerbangnyalah yang menolak.
--
-- DIAGNOSIS: secret dikirim ulang lewat dua cara lain, keduanya LOLOS gerbang
--   dan lanjut sampai tahap FCM:
--     ?k=<secret> di URL        -> lolos (status 500 di tahap FCM)
--     Authorization: Bearer …   -> lolos (status 500 di tahap FCM)
--   Sedangkan `x-cron-secret` selalu ditolak.
--   Kesimpulan: nilai CRON_SECRET di Edge Functions SUDAH cocok dengan Vault;
--   yang tak sampai adalah HEADER KUSTOM-nya — tersaring di perjalanan
--   pg_net -> gerbang Edge Function. Jangan buang waktu mencurigai nilainya.
--
-- KENAPA `Authorization`, BUKAN `?k=`:
--   Keduanya diterima cronAuthorized(). Tapi URL lengkap TERCETAK di log
--   permintaan Edge Function (terlihat sendiri saat menelusuri 401 di atas),
--   sehingga `?k=<secret>` menaruh rahasia itu di log — permanen dan terbaca
--   siapa pun yang bisa melihat log project. Header Authorization tak ikut ter-log.
--   Aman di sini karena kedua fungsi verify_jwt=false, jadi gerbang Supabase tak
--   menafsirkannya sebagai JWT.
--
-- Secret tetap dibaca dari Vault saat job berjalan — tak pernah jadi teks polos
--   di `cron.job.command` maupun di repo ini.
--
-- ⚠️ `20260811170000_jadwal_cron.sql` SUDAH diselaraskan memakai Authorization
--   juga. Keduanya idempoten dan menghasilkan keadaan akhir yang SAMA, jadi
--   urutan jalannya tak lagi berpengaruh — penting, sebab '091039' < '170000'
--   secara teks, sehingga di project baru berkas ini justru jalan LEBIH DULU.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'waseela-dispatch-push') then
    perform cron.unschedule('waseela-dispatch-push');
  end if;
  if exists (select 1 from cron.job where jobname = 'waseela-auto-tagihan') then
    perform cron.unschedule('waseela-auto-tagihan');
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
