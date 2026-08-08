-- ============================================================================
-- settings/mesin — baris setelan MESIN ABSENSI, hanya untuk admin.
--
-- KENAPA BARIS SENDIRI, BUKAN DITUMPANG DI settings/general:
--   `settings/general` SENGAJA anon-readable — branding layar login dan formulir
--   PSB publik membacanya sebelum ada sesi. Menaruh secret webhook di sana berarti
--   siapa pun bisa `GET /rest/v1/settings?key=eq.general`, membaca secret-nya, lalu
--   mengirim absensi PALSU ke `hiview-absen`.
--   Ini bukan kekhawatiran hipotetis: baris `settings/keuangan` (migrasi 20260729130000)
--   lahir persis karena tarif syahriyah & bisyaroh sempat bocor lewat `general`.
--   Migrasi ini mengikuti pola yang sama untuk setelan mesin.
--
-- BEDA DENGAN 'keuangan': admin_keuangan TIDAK diberi akses. Secret webhook =
--   kunci menulis absensi, urusan pengelola sistem, bukan pengelola keuangan.
--
-- Bentuk nilainya (semua opsional, diisi dari UI Mesin Absensi):
--   {
--     "jenis":         "hiview" | "fingerspot" | "",   -- jenis mesin yang dipakai
--     "webhookSecret": "<8-32 char>",                   -- dipakai hiview-absen (?k=)
--     "catatan":       "<bebas>"
--   }
-- ============================================================================

-- SELECT: 'mesin' hanya untuk pengelola sistem (super_admin / admin).
drop policy if exists settings_sel on public.settings;
create policy settings_sel on public.settings for select using (
  case
    when key = 'admin' then false
    when key = 'mesin' then public.auth_can_manage()
    when key = 'keuangan' then (public.auth_can_manage() or public.auth_can_keuangan())
    else true
  end
);

-- INSERT/UPDATE: admin_keuangan boleh menulis baris lain, TAPI tidak 'mesin'.
--   (Policy lama hanya mengecualikan 'admin', sehingga 'mesin' akan ikut tertulis.)
drop policy if exists settings_ins on public.settings;
create policy settings_ins on public.settings for insert with check (
  public.auth_can_manage()
  or (public.auth_can_keuangan() and key not in ('admin', 'mesin'))
);

drop policy if exists settings_upd on public.settings;
create policy settings_upd on public.settings
  for update
  using (
    public.auth_can_manage()
    or (public.auth_can_keuangan() and key not in ('admin', 'mesin'))
  )
  with check (
    public.auth_can_manage()
    or (public.auth_can_keuangan() and key not in ('admin', 'mesin'))
  );

-- Baris awal kosong supaya UI punya sasaran tulis sejak hari pertama.
insert into public.settings (key, value)
values ('mesin', '{"jenis":"","webhookSecret":"","catatan":""}'::jsonb)
on conflict (key) do nothing;

comment on table public.settings is
  'Setelan aplikasi per-baris. general/web = anon-readable (branding login + PSB publik). '
  'keuangan = {super,admin,admin_keuangan}. mesin = {super,admin} SAJA (memuat secret webhook). '
  'admin = tak terbaca siapa pun lewat API.';
