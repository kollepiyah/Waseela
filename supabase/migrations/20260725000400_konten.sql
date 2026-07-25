-- ============================================================================
-- WASEELA · MT-04 KONTEN & SISTEM (multi-tenant) — port dari Ammu konten + profiles_rls.
-- posts, beranda, reactions, kegiatan, PSB, kritik, notif_queue, audit, backup,
-- scheduled_jobs, user_notif_state, link_preview_cache, profil_pesantren.
-- Catatan multi-tenant: "read publik" Ammu (`using(true)`) -> tenant-scoped. Anon
-- (pra-login) resolusi tenant via header x-tenant (lihat current_tenant_id()).
-- ============================================================================

create table public.posts (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  judul      text,
  isi        text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.beranda_post (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  judul      text,
  isi        text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.post_reactions (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  post_id    text not null,
  post_type  text not null,
  user_id    text not null,
  emoji      text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, post_id, post_type, user_id)
);
create index post_reactions_post_idx on public.post_reactions (tenant_id, post_type, post_id);

create table public.kegiatan (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  judul      text,
  tgl_mulai  text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index kegiatan_tgl_idx on public.kegiatan (tenant_id, tgl_mulai);

create table public.kegiatan_pesantren (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  judul      text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.kegiatan_master (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.profil_pesantren (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.kritik_saran (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  pesan      text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.psb_pendaftaran (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  nama       text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index psb_pendaftaran_created_idx on public.psb_pendaftaran (tenant_id, created_at);

create table public.notif_queue (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  judul      text,
  pesan      text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.audit_log (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  aksi       text,
  collection text,
  doc_id     text,
  user_id    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index audit_log_created_idx    on public.audit_log (tenant_id, created_at);
create index audit_log_collection_idx on public.audit_log (tenant_id, collection);

create table public.backup_hapus (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.scheduled_jobs (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.user_notif_state (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table public.link_preview_cache (
  tenant_id  uuid not null default public.current_tenant_id() references public.tenants(id),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- ---- Trigger updated_at (hanya tabel ber-kolom updated_at) ------------------
do $$
declare t text;
begin
  foreach t in array array[
    'posts','beranda_post','kegiatan','kegiatan_pesantren','kegiatan_master',
    'profil_pesantren','kritik_saran','psb_pendaftaran','notif_queue',
    'scheduled_jobs','user_notif_state'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---- Enable RLS (semua tabel konten) ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'posts','beranda_post','post_reactions','kegiatan','kegiatan_pesantren',
    'kegiatan_master','profil_pesantren','kritik_saran','psb_pendaftaran',
    'notif_queue','audit_log','backup_hapus','scheduled_jobs','user_notif_state',
    'link_preview_cache'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Archetype A (read dlm-tenant [was publik], write manage, delete super).
do $$
declare t text;
begin
  foreach t in array array[
    'posts','beranda_post','kegiatan','kegiatan_pesantren','kegiatan_master','profil_pesantren'
  ] loop
    execute format('create policy %I on public.%I for select using (tenant_id = public.current_tenant_id())', t||'_sel', t);
    execute format('create policy %I on public.%I for insert with check (public.auth_can_manage() and tenant_id = public.current_tenant_id())', t||'_ins', t);
    execute format('create policy %I on public.%I for update using (public.auth_can_manage() and tenant_id = public.current_tenant_id()) with check (public.auth_can_manage() and tenant_id = public.current_tenant_id())', t||'_upd', t);
    execute format('create policy %I on public.%I for delete using (public.auth_is_super() and tenant_id = public.current_tenant_id())', t||'_del', t);
  end loop;
end $$;

-- POST_REACTIONS: read dlm-tenant, write signedIn dlm-tenant.
create policy post_reactions_sel on public.post_reactions for select
  using (tenant_id = public.current_tenant_id());
create policy post_reactions_rw on public.post_reactions for all
  using (auth.uid() is not null and tenant_id = public.current_tenant_id())
  with check (auth.uid() is not null and tenant_id = public.current_tenant_id());

-- KRITIK_SARAN: read signedIn, create ANONIM (form, cek panjang) dlm-tenant, upd manage, del super.
create policy kritik_sel on public.kritik_saran for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy kritik_ins on public.kritik_saran for insert
  with check (char_length(coalesce(pesan,'')) between 1 and 2000
              and tenant_id = public.current_tenant_id());
create policy kritik_upd on public.kritik_saran for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy kritik_del on public.kritik_saran for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- PSB_PENDAFTARAN: read signedIn, create ANONIM (formulir) dlm-tenant, kelola manage.
create policy psb_sel on public.psb_pendaftaran for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy psb_ins on public.psb_pendaftaran for insert
  with check (char_length(coalesce(nama,'')) between 1 and 200
              and tenant_id = public.current_tenant_id());
create policy psb_upd on public.psb_pendaftaran for update
  using (public.auth_can_manage() and tenant_id = public.current_tenant_id())
  with check (public.auth_can_manage() and tenant_id = public.current_tenant_id());
create policy psb_del on public.psb_pendaftaran for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- NOTIF_QUEUE: TANPA read (server-only); tulis staff dlm-tenant.
create policy notif_queue_ins on public.notif_queue for insert
  with check (public.auth_is_staff() and tenant_id = public.current_tenant_id());
create policy notif_queue_upd on public.notif_queue for update
  using (public.auth_is_staff() and tenant_id = public.current_tenant_id())
  with check (public.auth_is_staff() and tenant_id = public.current_tenant_id());
create policy notif_queue_del on public.notif_queue for delete
  using (public.auth_is_staff() and tenant_id = public.current_tenant_id());

-- AUDIT_LOG: append-only (read+insert signedIn; tanpa update/delete) dlm-tenant.
create policy audit_sel on public.audit_log for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy audit_ins on public.audit_log for insert
  with check (auth.uid() is not null and tenant_id = public.current_tenant_id());

-- BACKUP_HAPUS: read signedIn, insert staff (tanpa update/delete) dlm-tenant.
create policy backup_sel on public.backup_hapus for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy backup_ins on public.backup_hapus for insert
  with check (public.auth_is_staff() and tenant_id = public.current_tenant_id());

-- SCHEDULED_JOBS: read signedIn, tulis staff, delete super — dlm-tenant.
create policy scheduled_sel on public.scheduled_jobs for select
  using (auth.uid() is not null and tenant_id = public.current_tenant_id());
create policy scheduled_ins on public.scheduled_jobs for insert
  with check (public.auth_is_staff() and tenant_id = public.current_tenant_id());
create policy scheduled_upd on public.scheduled_jobs for update
  using (public.auth_is_staff() and tenant_id = public.current_tenant_id())
  with check (public.auth_is_staff() and tenant_id = public.current_tenant_id());
create policy scheduled_del on public.scheduled_jobs for delete
  using (public.auth_is_super() and tenant_id = public.current_tenant_id());

-- USER_NOTIF_STATE: read dlm-tenant, tulis signedIn dlm-tenant.
create policy user_notif_state_sel on public.user_notif_state for select
  using (tenant_id = public.current_tenant_id());
create policy user_notif_state_rw on public.user_notif_state for all
  using (auth.uid() is not null and tenant_id = public.current_tenant_id())
  with check (auth.uid() is not null and tenant_id = public.current_tenant_id());

-- LINK_PREVIEW_CACHE: read dlm-tenant, tulis server-only (tanpa policy tulis).
create policy link_preview_sel on public.link_preview_cache for select
  using (tenant_id = public.current_tenant_id());
