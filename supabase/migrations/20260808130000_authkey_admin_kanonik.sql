-- ============================================================================
-- auth_key kanonik admin bawaan: 'adminmu' → 'admin'
--
-- MASALAH (ketahuan saat uji sebelum rilis, 8 Agu 2026):
--   resolve_login('admin') mengembalikan auth_key 'adminmu'. Klien memakai nilai itu
--   untuk membangun email login → 'adminmu@waseela.local', padahal akun yang dibuat
--   'admin@waseela.local'. Akibatnya LOGIN ADMIN SELALU GAGAL, dan pesannya cuma
--   "login gagal" tanpa petunjuk apa pun.
--
-- KENAPA 'admin', BUKAN 'adminmu':
--   Akhiran "mu" pada 'adminmu' merujuk nama lembaga di repo asal. Standar
--   white-label Waseela: nol jejak lembaga lain di identifier internal, termasuk
--   nama akun bawaan. 'adminmu' TETAP diterima sebagai masukan (alias legacy) supaya
--   pemasangan lama tak patah — yang berubah hanya nilai KANONIK yang dikembalikan.
--
-- Perubahan tunggal: kolom terakhir cabang admin, 'adminmu'::text → 'admin'::text.
-- Sisa badan fungsi disalin apa adanya.
-- ============================================================================
create or replace function public._resolve_authkey(p_input text, p_source text default null::text)
returns table(source text, ref_id text, role_sistem text, supervisi boolean, active boolean, auth_key text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with k as (
    select public._norm_key(p_input) as key,
           public._digits(p_input) as dig,
           nullif(lower(coalesce(p_source, '')), '') as src
  )
  select * from (
    -- admin built-in -> super_admin. Ikut jalur guru/pegawai.
    -- Kanonik 'admin'; 'adminmu' tetap diterima sebagai masukan (alias legacy).
    select 'admin'::text, 'admin'::text, 'super_admin'::text, true, true, 'admin'::text
    from k
    where k.key in ('adminmu', 'admin')
      and (k.src is null or k.src = 'guru')
    union all
    -- guru: cocok via username ATAU WA; kanonik = username (jika ada) else digits(wa)
    select 'guru', g.id, g.role_sistem,
           (lower(coalesce(g.jabatan, '')) ~ 'direktur|supervisor'
            or lower(coalesce(g.jabatan_tambahan, '')) ~ 'direktur|supervisor'),
           (g.status is distinct from 'Tidak Aktif'),
           coalesce(nullif(public._norm_key(g.username), ''), public._digits(g.wa))
    from public.guru g, k
    where (k.src is null or k.src = 'guru')
      and (nullif(public._norm_key(g.username), '') = k.key
           or (k.dig <> '' and public._digits(g.wa) = k.dig))
    union all
    -- santri: cocok via NIS ATAU WA wali; kanonik = NIS (jika ada) else digits(wa)
    select 'santri', s.id, 'santri', false,
           coalesce(s.aktif, true),
           coalesce(nullif(public._digits(s.nis), ''), public._digits(s.wa))
    from public.santri s, k
    where (k.src is null or k.src = 'santri')
      and ((k.dig <> '' and public._digits(s.nis) = k.dig)
           or (k.dig <> '' and public._digits(s.wa) = k.dig))
  ) t
  limit 1
$function$;

-- Fungsi internal: tak boleh dipanggil langsung anon/authenticated (cermin fase
-- hardening di repo asal — resolve_login yang jadi pintu publiknya).
revoke execute on function public._resolve_authkey(text, text) from public, anon, authenticated;
