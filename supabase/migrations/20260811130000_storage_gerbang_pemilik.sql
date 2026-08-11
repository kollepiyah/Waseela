-- ============================================================================
-- AUDIT AGU 2026 · Batch 4 — gerbang PEMILIK untuk bucket `photo` dan `psb`.
--
-- LATAR (terukur 11 Agu 2026): policy storage.objects untuk kedua bucket ini
--   hanya memeriksa `bucket_id`, tanpa syarat siapa pemiliknya:
--
--     photo_upd / photo_del : using (bucket_id = 'photo')
--     psb_upd   / psb_del   : using (bucket_id = 'psb')
--
--   Artinya SETIAP pengguna yang login boleh menimpa dan MENGHAPUS berkas
--   siapa pun di bucket itu — foto seluruh santri & guru, tanda tangan, dan
--   seluruh bukti transfer. Digabung pendaftaran mandiri yang masih terbuka
--   (lihat AUDIT-AGU-2026.md temuan #2), "pengguna yang login" = siapa saja di
--   internet. Storage tak punya versi cadangan: terhapus = hilang.
--
--   Bucket `branding` SUDAH benar (auth_can_manage() di ins/upd/del) — jadi
--   polanya memang sudah ada di repo, dua bucket ini saja yang belum menyusul.
--
-- KENAPA PEMILIK, BUKAN PERAN:
--   Memakai auth_can_manage() untuk upd/del akan MEMATAHKAN alur sah:
--     · ProfilPengaturanSaya — tiap peran (termasuk santri) mengganti foto &
--       tanda tangannya sendiri;
--     · PembayaranView (rute 'pembayaran' TANPA meta admin) — wali santri
--       mengunggah bukti transfer sendiri.
--   Gerbang pemilik menutup perusakan massal tanpa menyentuh keduanya.
--
-- KENAPA INI TIDAK MEMATAHKAN APA PUN:
--   Jalur unggah selalu unik — `profil_foto/<role>_<id>_<Date.now()>.jpg`,
--   `tanda_tangan/<role>_<id>_<Date.now()>.png`. Jadi:
--     · INSERT selalu ke jalur BARU  -> tak pernah butuh UPDATE (dibiarkan terbuka);
--     · DELETE hanya menyasar berkas yang tadi diunggah pengguna itu sendiri
--       -> `owner = auth.uid()` terpenuhi.
--   Penghapusan foto lama pun sudah 'best-effort' di klien (ProfilPengaturanSaya
--   v.108), jadi seandainya berkas lama milik admin, kegagalannya ditelan —
--   berkas yatim, bukan alur yang patah.
--   Saat migrasi ini ditulis: 2 objek total di seluruh storage, keduanya ber-owner.
--
-- YANG SENGAJA TIDAK DISENTUH:
--   · SELECT — dibiarkan apa adanya. Ketiga bucket masih `public = true`
--     sehingga tetap terbaca lewat URL publik tanpa login; memprivatkannya
--     butuh signed URL di sisi baca (perubahan komponen penampil gambar) dan
--     masih menunggu keputusan Kyai. Lihat temuan #4.
--   · INSERT — wajib tetap terbuka untuk swalayan (foto sendiri, bukti transfer).
--   · branding_* — sudah benar sejak awal.
--
-- BALIK ARAH:
--   drop policy photo_upd on storage.objects;
--   create policy photo_upd on storage.objects for update to authenticated
--     using (bucket_id = 'photo') with check (bucket_id = 'photo');
--   (idem photo_del / psb_upd / psb_del)
-- ============================================================================

-- ---- photo: ubah & hapus hanya oleh pemilik berkas atau pengelola -----------
drop policy if exists photo_upd on storage.objects;
create policy photo_upd on storage.objects for update to authenticated
  using       (bucket_id = 'photo' and (owner = auth.uid() or public.auth_can_manage()))
  with check  (bucket_id = 'photo' and (owner = auth.uid() or public.auth_can_manage()));

drop policy if exists photo_del on storage.objects;
create policy photo_del on storage.objects for delete to authenticated
  using       (bucket_id = 'photo' and (owner = auth.uid() or public.auth_can_manage()));

-- ---- psb: idem ------------------------------------------------------------
drop policy if exists psb_upd on storage.objects;
create policy psb_upd on storage.objects for update to authenticated
  using       (bucket_id = 'psb' and (owner = auth.uid() or public.auth_can_manage()))
  with check  (bucket_id = 'psb' and (owner = auth.uid() or public.auth_can_manage()));

drop policy if exists psb_del on storage.objects;
create policy psb_del on storage.objects for delete to authenticated
  using       (bucket_id = 'psb' and (owner = auth.uid() or public.auth_can_manage()));
