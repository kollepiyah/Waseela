-- ============================================================================
-- WASEELA · MT-10 FASE 7 HARDENING (keamanan) — tutup temuan Supabase advisor.
--
-- Dua kelompok temuan (semua level WARN, tak ada ERROR; DB belum ada data produksi):
--
--  (1) 0011 function_search_path_mutable — 3 fungsi util tanpa `search_path` tetap.
--      set_updated_at / _digits / _norm_key hanya memakai builtin pg_catalog
--      (now / regexp_replace / lower) -> aman dikunci ke search_path = '' .
--
--  (2) 0028/0029 (anon|authenticated)_security_definer_function_executable —
--      fungsi SECURITY DEFINER ter-expose sbg RPC PostgREST (grant EXECUTE default
--      ke PUBLIC). Dicabut HANYA untuk fungsi yang TIDAK dipakai di dalam policy:
--        * handle_new_user, sync_guru_profile_role  = fungsi TRIGGER
--          (invokasi trigger TIDAK cek EXECUTE pemanggil -> trigger tetap jalan).
--        * _resolve_authkey = internal, cuma dipanggil di dalam resolve_login /
--          handle_new_user yang SECURITY DEFINER (panggilan dalam = konteks definer
--          -> resolve_login tetap jalan untuk anon).
--      Diverifikasi: ketiga fungsi ini TIDAK muncul di 'create policy' mana pun.
--
--  CATATAN (sisa 0028/0029 sengaja DIBIARKAN): helper peran/tenant
--    (auth_can_manage, auth_is_super, current_tenant_id, auth_can_akademik, dst)
--    DIPAKAI DI DALAM RLS policy + DEFAULT kolom. Mencabut EXECUTE-nya dari
--    authenticated akan membuat evaluasi policy 'permission denied'. Solusi benar =
--    pindahkan ke schema privat (mis. `private`) + tulis-ulang rujukan policy/default.
--    Itu perubahan besar & security-critical (wajib re-run test isolasi) -> dijadwalkan
--    sebagai sub-tugas terpisah. Risiko dibiarkan: NIHIL kebocoran data — fungsi ini
--    hanya mengembalikan status peran/tenant si PEMANGGIL sendiri (bukan data lembaga).
-- ============================================================================

-- (1) Kunci search_path 3 util --------------------------------------------------
alter function public.set_updated_at() set search_path = '';
alter function public._digits(text)    set search_path = '';
alter function public._norm_key(text)  set search_path = '';

-- (2) Cabut permukaan RPC untuk fungsi trigger + internal-definer ---------------
revoke execute on function public.handle_new_user()                      from public, anon, authenticated;
revoke execute on function public.sync_guru_profile_role()               from public, anon, authenticated;
revoke execute on function public._resolve_authkey(text, text, uuid)     from public, anon, authenticated;
