#!/usr/bin/env node
// ============================================================================
// WASEELA · Migrasi BULK data Firestore → Supabase (per-tenant).
//
// Membaca semua koleksi Firestore satu project lembaga, memetakan tiap dokumen
// ke baris Postgres (kolom-riil + ekor jsonb — CERMIN app/src/services/db.js),
// menstempel tenant_id, lalu UPSERT ke Supabase (service_role, bypass RLS).
//
// PEMAKAIAN:
//   node scripts/migrate-firestore-to-supabase.mjs <tenant-slug> [--dry] [--only=santri,guru]
//
// ENV WAJIB (mis. via .env atau shell):
//   FIREBASE_SERVICE_ACCOUNT   = path JSON service account project SUMBER (Firestore)
//   SUPABASE_URL               = https://<ref>.supabase.co   (target)
//   SUPABASE_SERVICE_ROLE_KEY  = service_role key target (RAHASIA — jangan commit)
//
// CATATAN:
//   - tenant <slug> HARUS sudah ada di tabel public.tenants (buat via konsol dulu).
//   - Idempoten: UPSERT on (tenant_id, pk). Aman dijalankan ulang.
//   - Timestamp Firestore → ISO string. Field nested/array → masuk ekor jsonb.
//   - PETA SKEMA di bawah WAJIB sinkron dengan db.js (COLS/SPECIAL).
//
// DEPENDENSI (sekali): npm i -D firebase-admin @supabase/supabase-js
// ============================================================================
import { readFileSync } from 'node:fs'
// firebase-admin v12+ (ESM): pakai modular API, BUKAN default namespace (admin.credential undefined di ESM).
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

// ---- PETA SKEMA (cermin app/src/services/db.js) ---------------------------
const COLS = {
  santri: ['nis','nisn','nik','nama','jk','lembaga','kelas','lembaga_sekolah','kelas_sekolah','juz','wali','wa','aktif','is_mukim','is_fullday','foto'],
  guru: ['nama','nik','jk','jabatan','jabatan_tambahan','lembaga','lembaga_sekolah','tipe_pegawai','shift','status','username','wa','foto','role_sistem','id_fingerprint'],
  lembaga: ['nama','urutan'],
  keuangan_tagihan: ['santri_id','periode','kategori','nominal','terbayar','status','tanggal'],
  keuangan_buku_induk: ['tipe','sumber','nominal','tanggal','keterangan'],
  keuangan_tabungan_santri: ['santri_id','jenis','nominal','tanggal'],
  keuangan_uang_saku_santri: ['santri_id','jenis','nominal','tanggal'],
  keuangan_gaji: ['guru_id','periode','bisyaroh_pokok','total_pemasukan','total_potongan','tunjangan_list','potongan_list'],
  keuangan_hutang_piutang: ['nominal'],
  keuangan_pembayaran: ['santri_id','nominal','tanggal'],
  tabungan_mutasi: ['ref_id','nominal'],
  pembayaran_konfirmasi: ['santri_id','nominal','status','tanggal_transfer'],
  pembayaran_transfer_pending: ['santri_id','nominal','status'],
  pengaturan_keuangan: [],
  absensi: ['santri_id','tanggal','lembaga','kelas','status'],
  absensi_guru: ['guru_id','tanggal'],
  absensi_shift_guru: ['guru_id','periode'],
  absensi_kegiatan: [],
  absensi_santri_sekolah: ['santri_id','tanggal'],
  absensi_santri_sekolah_bulanan: ['santri_id','periode','sakit','izin','alpa','hadir'],
  absensi_santri_ngaji_bulanan: ['santri_id','periode','sakit','izin','alpa','hadir'],
  rapor_semester: ['santri_id','lembaga','semester','tahun_ajaran'],
  rekap_diniyah: ['santri_id'],
  rekap_prestasi: ['santri_id','lembaga','kelas'],
  riwayat_prestasi: ['santri_id','periode'],
  notif_prestasi: ['santri_id'],
  riwayat_kenaikan: ['santri_id','tanggal'],
  tes_kenaikan: ['santri_id','lembaga','status'],
  tes_glondongan: ['santri_id','ajuan_id','tipe','kelas_asal','status','penguji_id','periode'],
  ceremonial_ptpt: ['tanggal','jam_mulai','status','periode'],
  izin_guru: ['guru_id','status'],
  supervisi_catatan: ['target_type','target_id','judul','catatan'],
  posts: ['judul','isi'],
  beranda_post: ['judul','isi'],
  kegiatan: ['judul','tgl_mulai'],
  kegiatan_pesantren: ['judul'],
  kegiatan_master: [],
  profil_pesantren: [],
  kritik_saran: ['pesan'],
  pengaduan: ['pesan'],
  psb_pendaftaran: ['nama'],
  notif_queue: ['judul','pesan'],
  audit_log: ['aksi','collection','doc_id','user_id'],
  backup_hapus: [],
  scheduled_jobs: [],
  user_notif_state: [],
  link_preview_cache: []
}
const SPECIAL = {
  master: { pk: 'key', json: 'value', cols: [] },
  settings: { pk: 'key', json: 'value', cols: [] }
  // profiles SENGAJA di-skip: identitas auth dibuat via provisioning, bukan impor.
}
// Koleksi Firestore yang TIDAK diimpor (dikelola auth/sistem).
const SKIP = new Set(['profiles', 'tenants', 'langganan'])

function cfg(table) {
  if (SPECIAL[table]) return SPECIAL[table]
  return { pk: 'id', json: 'data', cols: COLS[table] || [] }
}

// Firestore Timestamp / nested → JSON-serializable (ISO untuk timestamp).
function norm(v) {
  if (v == null) return v
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()      // Firestore Timestamp
  if (Array.isArray(v)) return v.map(norm)
  if (typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) o[k] = norm(v[k])
    return o
  }
  return v
}

// dokumen Firestore → baris Postgres (kolom riil + ekor jsonb + tenant_id).
function toRow(table, docId, doc, tenantId) {
  const { pk, json, cols } = cfg(table)
  const row = { tenant_id: tenantId, [pk]: String(docId) }
  const tail = {}
  for (const [k, raw] of Object.entries(doc)) {
    if (k === 'id' || k === pk) continue
    const val = norm(raw)
    if (k === 'created_at' || k === 'updated_at') { row[k] = val; continue }
    if (cols.includes(k)) row[k] = val
    else tail[k] = val
  }
  row[json] = tail
  return row
}

async function main() {
  const [slug, ...rest] = process.argv.slice(2)
  if (!slug) { console.error('Usage: node scripts/migrate-firestore-to-supabase.mjs <tenant-slug> [--dry] [--only=a,b]'); process.exit(1) }
  const dry = rest.includes('--dry')
  const onlyArg = rest.find((a) => a.startsWith('--only='))
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT
  const sbUrl = process.env.SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!saPath || !sbUrl || !sbKey) { console.error('ENV kurang: FIREBASE_SERVICE_ACCOUNT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

  initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
  const fs = getFirestore()
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } })

  // resolve tenant uuid
  const { data: tenant, error: te } = await sb.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (te || !tenant) { console.error(`Tenant "${slug}" tak ditemukan di public.tenants. Buat dulu.`, te?.message || ''); process.exit(1) }
  const tenantId = tenant.id
  console.log(`→ Migrasi ke tenant "${slug}" (${tenantId}) ${dry ? '[DRY-RUN]' : ''}`)

  const collections = await fs.listCollections()
  let grand = 0
  for (const col of collections) {
    const table = col.id
    if (SKIP.has(table)) { console.log(`  · skip ${table}`); continue }
    if (only && !only.has(table)) continue
    if (!SPECIAL[table] && !(table in COLS)) { console.warn(`  ! ${table}: tak ada di peta skema → dilewati (tambahkan ke COLS bila perlu)`); continue }
    const { pk } = cfg(table)

    const snap = await fs.collection(table).get()
    const rows = snap.docs.map((d) => toRow(table, d.id, d.data(), tenantId))
    console.log(`  · ${table}: ${rows.length} dok`)
    grand += rows.length
    if (dry || rows.length === 0) continue

    // UPSERT batch 500 (on conflict tenant_id,pk)
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const { error } = await sb.from(table).upsert(batch, { onConflict: `tenant_id,${pk}` })
      if (error) { console.error(`    ✗ ${table} batch ${i}:`, error.message); process.exit(1) }
    }
    console.log(`    ✓ ${table} ter-upsert`)
  }
  console.log(`\nSelesai. Total ${grand} dokumen ${dry ? '(dry-run, tak ditulis)' : 'termigrasi'}.`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
