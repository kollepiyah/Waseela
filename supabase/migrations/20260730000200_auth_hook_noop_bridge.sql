-- ============================================================================
-- WASEELA · BRIDGE — no-op custom_access_token_hook (perbaiki login 500).
--
-- MASALAH: Auth config (GoTrue) MASIH mendaftarkan hook
--   `pg-functions://postgres/app/custom_access_token_hook` (sisa percobaan lama
--   arsitektur JWT-claims), padahal skema `app` sudah di-drop → fungsi tak ada →
--   TIAP penerbitan token (signIn) gagal 500 "Error running hook URI ..." →
--   LOGIN MUSTAHIL (signUp bikin user tapi tanpa sesi).
--
-- FIX PERMANEN (butuh dashboard): Authentication → Hooks → HAPUS "Custom Access
--   Token" hook. Sesudah itu, fungsi + schema `app` ini boleh di-drop.
--
-- BRIDGE (file ini): buat ulang fungsi sebagai NO-OP pass-through supaya hook
--   berhenti error. Arsitektur kita TIDAK memakai JWT-claims (tenant di-resolve via
--   profiles.tenant_id + current_tenant_id()), jadi hook memang tak perlu menyuntik
--   apa pun — cukup kembalikan `event` apa adanya.
-- ============================================================================
create schema if not exists app;

create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb language sql stable as $$
  select event
$$;

grant usage on schema app to supabase_auth_admin;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function app.custom_access_token_hook(jsonb) from authenticated, anon, public;
