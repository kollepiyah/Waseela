-- ============================================================================
-- WASEELA · admin_target_auth_uid() — pendukung Edge Function reset-user-password.
--
-- GUARD super_admin (peran pemanggil) + TENANT-SCOPED: resolve auth.users.id target
-- (guru/santri) DALAM tenant pemanggil, via email kanonik `<auth_key>@<slug>.waseela.local`.
-- Return NULL bila akun belum ada (lazy-create sandi default saat login pertama).
-- ============================================================================
create or replace function public.admin_target_auth_uid(p_collection text, p_doc_id text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_slug   text;
  v_key    text;
  v_uid    uuid;
begin
  if not private.auth_is_super() then raise exception 'forbidden'; end if;
  select t.slug into v_slug from public.tenants t where t.id = v_tenant;
  if v_slug is null then raise exception 'not-found'; end if;

  if p_collection = 'guru' then
    select coalesce(nullif(public._norm_key(g.username), ''), public._digits(g.wa)) into v_key
      from public.guru g where g.id = p_doc_id and g.tenant_id = v_tenant;
  elsif p_collection = 'santri' then
    select coalesce(nullif(public._digits(s.nis), ''), public._digits(s.wa)) into v_key
      from public.santri s where s.id = p_doc_id and s.tenant_id = v_tenant;
  else
    raise exception 'bad-input';
  end if;

  if v_key is null or v_key = '' then raise exception 'not-found'; end if;
  select id into v_uid from auth.users where email = v_key || '@' || v_slug || '.waseela.local';
  return v_uid;
end $$;
revoke execute on function public.admin_target_auth_uid(text, text) from anon, public;
grant execute on function public.admin_target_auth_uid(text, text) to authenticated;
