-- ============================================================================
-- WASEELA · platform_stats() — agregat lintas-tenant utk dashboard konsol owner.
--
-- platform_owner TIDAK punya akses RLS ke santri/guru lembaga (privasi). Untuk
-- dashboard butuh HITUNGAN (bukan data), jadi RPC SECURITY DEFINER yang HANYA
-- mengembalikan COUNT + info tenant/langganan (tanpa PII). Guard: baris hanya
-- keluar bila pemanggil platform_owner (else 0 baris).
-- ============================================================================
create or replace function public.platform_stats()
returns table(
  tenant_id uuid, slug text, nama text, plan text, aktif boolean,
  santri_count bigint, guru_count bigint,
  langganan_status text, langganan_plan text, berakhir date
)
language sql stable security definer set search_path = public as $$
  select
    t.id, t.slug, t.nama, t.plan, t.aktif,
    (select count(*) from public.santri s where s.tenant_id = t.id),
    (select count(*) from public.guru g where g.tenant_id = t.id),
    l.status, l.plan, l.berakhir
  from public.tenants t
  left join lateral (
    select status, plan, berakhir from public.langganan
    where tenant_id = t.id order by created_at desc limit 1
  ) l on true
  where private.auth_is_platform_owner()   -- guard: non-owner → 0 baris
  order by t.created_at
$$;
revoke execute on function public.platform_stats() from anon, public;
grant execute on function public.platform_stats() to authenticated;
