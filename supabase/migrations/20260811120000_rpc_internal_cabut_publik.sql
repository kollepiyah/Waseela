-- ============================================================================
-- AUDIT AGU 2026 · Batch 3 — cabut EXECUTE publik pada fungsi INTERNAL.
--
-- LATAR (terukur 11 Agu 2026, project live vfbmaywcjurykxfetbia):
--   Postgres memberi EXECUTE kepada PUBLIC secara BAWAAN pada setiap fungsi.
--   Akibatnya tiap fungsi `security definer` yang tak pernah dicabut otomatis
--   dapat dipanggil peran `anon` lewat PostgREST: /rest/v1/rpc/<nama>.
--   Advisor Supabase menandai 67 fungsi dalam bentuk ini. Yang selamat hanya
--   yang kebetulan punya gerbang di DALAM badannya (mis. analytics_query yang
--   memanggil auth_can_manage() lebih dulu).
--
--   Tiga tak punya gerbang apa pun:
--
--   K1. _enqueue_notif  — TERPARAH, rantainya utuh sampai HP pengguna:
--         anon -> /rest/v1/rpc/_enqueue_notif (judul, pesan, target, LINK bebas)
--              -> insert notif_queue (status 'pending')
--              -> dispatch-push (pg_cron tiap menit, service-role) memungut
--              -> FCM terkirim ke santri / wali santri / guru.
--       Anon key memang PUBLIK (tertanam di web app), jadi ini bukan skenario
--       "kalau kunci bocor" — sudah terbuka sejak fungsi ini ada. Bidang `link`
--       yang paling berbahaya: phishing yang tiba lewat aplikasi lembaga sendiri,
--       jadi tampak sah di mata wali santri.
--
--   K2. cleanup_audit_log — anon dapat menghapus audit_log > 90 hari. Dampak
--       hari ini kecil (app baru live Agu 2026, belum ada baris setua itu),
--       tapi tumbuh diam-diam dan justru jejak forensik yang hilang.
--
--   K3. _provisi_diizinkan(email) — orakel: memberi tahu apakah sebuah email
--       sedang punya izin provisi aktif. Bocoran kecil, tapi cuma-cuma.
--
-- KENAPA `authenticated` IKUT DICABUT, bukan `anon` saja:
--   Lihat header 20260803120000. Pendaftaran mandiri Supabase Auth masih aktif
--   dan loginUnified mem-signUp dengan sandi apa pun saat akun belum ada —
--   siapa pun di internet bisa mencetak JWT `authenticated` yang SAH. Di app ini
--   `authenticated` BUKAN batas kepercayaan. Mencabut dari `anon` saja = tambalan
--   yang terlihat rapi tapi tak menutup apa-apa.
--
-- KENAPA INI TIDAK AKAN MEMATIKAN APA PUN:
--   1. Tak satu pun dari 13 fungsi ini dipanggil dari klien atau Edge Function
--      (sudah di-grep seluruh app/src dan supabase/functions — nihil).
--   2. Fungsi tg_* / handle_new_user / sync_* / guard_* hanya dijalankan MESIN
--      TRIGGER. Postgres memeriksa hak EXECUTE pada fungsi trigger saat CREATE
--      TRIGGER, BUKAN saat trigger menyala. Mencabut EXECUTE tidak membuat
--      trigger yang sudah terpasang berhenti.
--   3. _enqueue_notif dipanggil dari dalam tg_* yang `security definer` milik
--      postgres -> saat berjalan pemakainya postgres = PEMILIK fungsi -> selalu
--      boleh, lepas dari grant PUBLIC.
--   4. cleanup_audit_log dipanggil pg_cron sebagai postgres — idem.
--   5. service_role tetap di-GRANT ulang di bawah sebagai jaring pengaman,
--      seandainya ada jalur sisi-server yang luput dari grep.
--
-- YANG SENGAJA TIDAK DISENTUH:
--   · resolve_login / _digits / _norm_key — WAJIB tetap `anon`, dipakai layar
--     login sebelum sesi ada. (resolve_login memang orakel keberadaan akun;
--     itu melekat pada rancangan login, dibahas terpisah di laporan audit.)
--   · auth_can_* / auth_is_* / auth_guru_* dll — juga ditandai advisor, tapi
--     SENGAJA dibiarkan. Isinya cuma fakta tentang PEMANGGIL SENDIRI (anon
--     memanggilnya dapat false/null — nol data bocor), sedangkan RLS bergantung
--     padanya. Mencabutnya berisiko mematikan RLS di seluruh app live demi
--     keuntungan keamanan nol. Advisor menandainya karena polanya, bukan karena
--     ada bocoran nyata.
--   · set_updated_at/_rupiah/_role_rank — `security invoker`, jalan dengan hak
--     pemanggil; tak bisa dipakai naik hak. Kebersihan saja, bukan lubang.
--
-- BALIK ARAH (kalau ternyata ada yang mati):
--   grant execute on function public.<nama>(<argumen>) to anon, authenticated;
-- ============================================================================

-- ---- K1 · penyuntik notifikasi — lubang utama ------------------------------
revoke execute on function public._enqueue_notif(text, text, jsonb, text, text)
  from public, anon, authenticated;
grant  execute on function public._enqueue_notif(text, text, jsonb, text, text)
  to service_role;

-- ---- K2 · penghapus audit log ---------------------------------------------
revoke execute on function public.cleanup_audit_log()
  from public, anon, authenticated;
grant  execute on function public.cleanup_audit_log()
  to service_role;

-- ---- K3 · orakel izin provisi ---------------------------------------------
revoke execute on function public._provisi_diizinkan(text)
  from public, anon, authenticated;
grant  execute on function public._provisi_diizinkan(text)
  to service_role;

-- ---- Fungsi trigger: tak pernah dipanggil langsung oleh siapa pun ----------
-- Dibiarkan terbuka berarti seseorang dapat menjalankan badan trigger di luar
-- konteksnya. Sebagian besar gagal tanpa TG_OP/NEW, tapi tak ada satu pun
-- alasan sah untuk membiarkannya bisa dipanggil.
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.sync_guru_profile_role()       from public, anon, authenticated;
revoke execute on function public.guard_guru_self_escalation()   from public, anon, authenticated;
revoke execute on function public.tg_beranda_post_notif()        from public, anon, authenticated;
revoke execute on function public.tg_kenaikan_notif()            from public, anon, authenticated;
revoke execute on function public.tg_pembayaran_verified_notif() from public, anon, authenticated;
revoke execute on function public.tg_prestasi_notif()            from public, anon, authenticated;
revoke execute on function public.tg_tagihan_notif()             from public, anon, authenticated;
revoke execute on function public.tg_tes_decided_notif()         from public, anon, authenticated;
revoke execute on function public.tg_tes_diajukan_notif()        from public, anon, authenticated;
