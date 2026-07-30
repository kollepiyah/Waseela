// db.js — WASEELA Fase 3 (migrasi Supabase): adapter CRUD generik API-IDENTIK dengan
// services/firestore.js, target Supabase Postgres (PostgREST + Realtime).
//
// Cutover per-koleksi (Fase 6) cukup ganti import
//   `from '@/services/firestore'`  ->  `from '@/services/db'`  (pemanggil tak berubah).
//
// MULTI-TENANT: adapter ini TENANT-AGNOSTIK — isolasi dikerjakan SERVER:
//   - BACA  : RLS auto-scope `tenant_id = current_tenant_id()`. `.eq('id', x)` +
//             maybeSingle AMAN walau PK komposit (tenant_id,id): RLS memfilter ke
//             tenant aktif -> tepat 1 baris.
//   - TULIS : kolom `tenant_id` DEFAULT `current_tenant_id()` -> auto-stempel saat INSERT.
//   Jadi TAK ada filter tenant_id di client (anon key publik; RLS yang menjaga).
//
// Pola HYBRID (lihat supabase/migrations): tiap baris = kolom riil (difilter/sort/RLS)
// + 1 kolom jsonb "ekor" (`data`, atau `value`/`akses`). Adapter flatten/split.
import { supabase } from './supabase'

function _ensure() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi (.env.local).')
}

// ============================================================================
// PETA SKEMA — kolom riil SKALAR per tabel (selain pk, ekor jsonb, created/updated_at).
// Sumber kebenaran: supabase/migrations. Field di luar daftar -> ekor jsonb saat TULIS.
// CATATAN: tabel fitur incremental (tes_glondongan, ceremonial_ptpt, pengaduan)
//   DIPETAKAN maju — tabelnya menyusul di migration Fase 2b-sisa/4.
// ============================================================================
const COLS = {
  // -- core --
  santri: ['nis','nisn','nik','nama','jk','lembaga','kelas','lembaga_sekolah','kelas_sekolah','juz','wali','wa','aktif','is_mukim','is_fullday','foto'],
  guru: ['nama','nik','jk','jabatan','jabatan_tambahan','lembaga','lembaga_sekolah','tipe_pegawai','shift','status','username','wa','foto','role_sistem','id_fingerprint'],
  lembaga: ['nama', 'urutan'],
  // -- keuangan --
  keuangan_tagihan: ['santri_id','periode','kategori','nominal','terbayar','status','tanggal'],
  keuangan_buku_induk: ['tipe', 'sumber', 'nominal', 'tanggal', 'keterangan'],
  keuangan_tabungan_santri: ['santri_id', 'jenis', 'nominal', 'tanggal'],
  keuangan_uang_saku_santri: ['santri_id', 'jenis', 'nominal', 'tanggal'],
  keuangan_gaji: ['guru_id','periode','bisyaroh_pokok','total_pemasukan','total_potongan','tunjangan_list','potongan_list'],
  keuangan_hutang_piutang: ['nominal'],
  keuangan_pembayaran: ['santri_id', 'nominal', 'tanggal'],
  tabungan_mutasi: ['ref_id', 'nominal'],
  pembayaran_konfirmasi: ['santri_id', 'nominal', 'status', 'tanggal_transfer'],
  pembayaran_transfer_pending: ['santri_id', 'nominal', 'status'],
  pengaturan_keuangan: [],
  // -- akademik --
  absensi: ['santri_id', 'tanggal', 'lembaga', 'kelas', 'status'],
  absensi_guru: ['guru_id', 'tanggal'],
  absensi_shift_guru: ['guru_id', 'periode'],
  absensi_kegiatan: [],
  absensi_santri_sekolah: ['santri_id', 'tanggal'],
  absensi_santri_sekolah_bulanan: ['santri_id', 'periode', 'sakit', 'izin', 'alpa', 'hadir'],
  absensi_santri_ngaji_bulanan: ['santri_id', 'periode', 'sakit', 'izin', 'alpa', 'hadir'],
  rapor_semester: ['santri_id', 'lembaga', 'semester', 'tahun_ajaran'],
  rekap_diniyah: ['santri_id'],
  rekap_prestasi: ['santri_id', 'lembaga', 'kelas'],
  riwayat_prestasi: ['santri_id', 'periode'],
  notif_prestasi: ['santri_id'],
  riwayat_kenaikan: ['santri_id', 'tanggal'],
  tes_kenaikan: ['santri_id', 'lembaga', 'status'],
  tes_glondongan: ['santri_id','ajuan_id','tipe','kelas_asal','status','penguji_id','periode'], // Fase 4
  ceremonial_ptpt: ['tanggal', 'jam_mulai', 'status', 'periode'], // Fase 4
  izin_guru: ['guru_id', 'status'],
  supervisi_catatan: ['target_type', 'target_id', 'judul', 'catatan'],
  // -- konten & sistem --
  posts: ['judul', 'isi'],
  beranda_post: ['judul', 'isi'],
  kegiatan: ['judul', 'tgl_mulai'],
  kegiatan_pesantren: ['judul'],
  kegiatan_master: [],
  profil_pesantren: [],
  kritik_saran: ['pesan'],
  pengaduan: ['pesan'], // Fase 4
  psb_pendaftaran: ['nama'],
  notif_queue: ['judul', 'pesan'],
  audit_log: ['aksi', 'collection', 'doc_id', 'user_id'],
  backup_hapus: [],
  scheduled_jobs: [],
  user_notif_state: [],
  link_preview_cache: []
}

// Tabel dgn pk / ekor jsonb NON-standar (default: pk='id', ekor='data').
const SPECIAL = {
  master: { pk: 'key', json: 'value', cols: [] },
  settings: { pk: 'key', json: 'value', cols: [] },
  profiles: {
    pk: 'id',
    json: 'akses',
    cols: ['login_key', 'role', 'role_sistem', 'supervisi', 'pengaduan', 'santri_id', 'guru_id']
  }
}

// Realtime whitelist (WAJIB cermin publication supabase_realtime — lihat migration
// Fase 2b-sisa realtime). Non-whitelist -> subscribe = fetch sekali + no-op.
const REALTIME = new Set([
  'beranda_post','posts','post_reactions','rekap_prestasi','riwayat_prestasi',
  'notif_prestasi','riwayat_kenaikan','tes_kenaikan','tes_glondongan','ceremonial_ptpt',
  'user_notif_state','kritik_saran','pengaduan','supervisi_catatan','absensi_guru',
  'keuangan_buku_induk','keuangan_tagihan','pembayaran_transfer_pending','absensi_shift_guru',
  'santri','guru','master','lembaga','settings',
  'izin_guru','rapor_semester','rekap_diniyah',
  'keuangan_gaji','keuangan_hutang_piutang','keuangan_tabungan_santri',
  'keuangan_uang_saku_santri',
  'kegiatan','psb_pendaftaran',
  'absensi_santri_ngaji_bulanan','absensi_santri_sekolah_bulanan'
])

function _cfg(table) {
  if (SPECIAL[table]) return SPECIAL[table]
  const cols = COLS[table]
  if (!cols && import.meta.env.DEV) {
    console.warn(`[db] tabel "${table}" tak ada di peta skema — semua field non-id masuk ke data jsonb.`)
  }
  return { pk: 'id', json: 'data', cols: cols || [] }
}

// ---- flatten / split ------------------------------------------------------
function _flatten(table, row) {
  if (!row) return null
  const { pk, json } = _cfg(table)
  const rest = { ...row }
  const tail = json ? rest[json] || {} : {}
  if (json) delete rest[json]
  // Buang tenant_id dari bentuk app (internal server-only).
  delete rest.tenant_id
  const out = { ...tail, ...rest }
  if (pk !== 'id') out.id = row[pk]
  return out
}

function _split(table, obj) {
  const { pk, json, cols } = _cfg(table)
  const row = {}
  const tail = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === pk) { row[pk] = v; continue }
    if (k === 'created_at' || k === 'updated_at' || k === 'tenant_id') continue // server-managed
    if (cols.includes(k)) row[k] = v
    else if (json) tail[k] = v
  }
  if (json) row[json] = tail
  return row
}

function _isPlainObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function _deepMerge(base, patch) {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = _isPlainObj(v) && _isPlainObj(out[k]) ? _deepMerge(out[k], v) : v
  }
  return out
}

function _colRef(table, field) {
  const { pk, json, cols } = _cfg(table)
  if (field === 'id') return pk
  if (field === pk || field === 'created_at' || field === 'updated_at' || cols.includes(field)) return field
  return json ? `${json}->>${field}` : field
}

function _applyFilters(q, table, filters) {
  for (const [field, op, val] of filters) {
    const ref = _colRef(table, field)
    switch (op) {
      case '==': q = q.eq(ref, val); break
      case '!=': q = q.neq(ref, val); break
      case '<': q = q.lt(ref, val); break
      case '<=': q = q.lte(ref, val); break
      case '>': q = q.gt(ref, val); break
      case '>=': q = q.gte(ref, val); break
      case 'in': q = q.in(ref, val); break
      case 'not-in': q = q.not(ref, 'in', `(${val.join(',')})`); break
      case 'array-contains': q = q.contains(ref, [val]); break
      case 'array-contains-any': q = q.overlaps(ref, val); break
      default: q = q.eq(ref, val)
    }
  }
  return q
}
function _applyOrders(q, table, orders) {
  for (const [field, dir] of orders) {
    q = q.order(_colRef(table, field), { ascending: String(dir).toLowerCase() !== 'desc' })
  }
  return q
}

async function _pageAll(build) {
  const PAGE = 1000
  let from = 0
  const out = []
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ============================================================================
// API publik — cermin firestore.js
// ============================================================================
export async function getOne(collectionName, id) {
  _ensure()
  const { pk } = _cfg(collectionName)
  const { data, error } = await supabase.from(collectionName).select('*').eq(pk, id).maybeSingle()
  if (error) throw error
  return _flatten(collectionName, data)
}

export async function getAll(collectionName) {
  _ensure()
  const rows = await _pageAll(() => supabase.from(collectionName).select('*'))
  return rows.map((r) => _flatten(collectionName, r))
}

export async function queryColl(collectionName, filters = [], orders = [], limitN = 0) {
  _ensure()
  const build = () => {
    let q = supabase.from(collectionName).select('*')
    q = _applyFilters(q, collectionName, filters)
    q = _applyOrders(q, collectionName, orders)
    return q
  }
  let rows
  if (limitN > 0) {
    const { data, error } = await build().limit(limitN)
    if (error) throw error
    rows = data || []
  } else {
    rows = await _pageAll(build)
  }
  return rows.map((r) => _flatten(collectionName, r))
}

async function _putRow(collectionName, id, fullDoc, exists) {
  const { pk } = _cfg(collectionName)
  const row = _split(collectionName, { ...fullDoc, id })
  if (exists) {
    const upd = { ...row }
    delete upd[pk]
    const { data, error } = await supabase.from(collectionName).update(upd).eq(pk, String(id)).select(pk)
    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error(`Gagal menyimpan ${collectionName}/${id}: tak ada baris yang berubah (kemungkinan ditolak RLS / hak akses kurang).`)
    }
  } else {
    const { error } = await supabase.from(collectionName).insert(row)
    if (error) throw error
  }
}

export async function setOne(collectionName, id, data) {
  _ensure()
  const exists = !!(await getOne(collectionName, id))
  await _putRow(collectionName, id, data, exists)
}

export async function mergeOne(collectionName, id, data) {
  _ensure()
  const existing = await getOne(collectionName, id)
  const merged = existing ? _deepMerge(existing, data) : { ...data }
  await _putRow(collectionName, id, merged, !!existing)
}

export async function updateOne(collectionName, id, partial) {
  _ensure()
  const { pk, json, cols } = _cfg(collectionName)
  const allCols = Object.keys(partial).every((k) => k === 'id' || k === pk || cols.includes(k))
  if (allCols) {
    const row = _split(collectionName, partial)
    delete row[pk]
    delete row[json]
    const { data, error } = await supabase.from(collectionName).update(row).eq(pk, String(id)).select(pk)
    if (error) throw error
    if (data && data.length > 0) return
    const existing = await getOne(collectionName, id)
    throw new Error(existing
      ? `Gagal menyimpan ${collectionName}/${id}: tak ada baris yang berubah (kemungkinan ditolak RLS / hak akses kurang).`
      : `Gagal menyimpan ${collectionName}/${id}: baris tidak ditemukan (mungkin sudah dihapus, atau tak terbaca karena RLS).`)
  }
  const existing = await getOne(collectionName, id)
  if (!existing) {
    throw new Error(`Gagal menyimpan ${collectionName}/${id}: baris tidak ditemukan (mungkin sudah dihapus, atau tak terbaca karena RLS).`)
  }
  const merged = { ...existing, ...partial }
  await _putRow(collectionName, id, merged, true)
}

export async function addOne(collectionName, data) {
  _ensure()
  const { pk } = _cfg(collectionName)
  const id = data.id || _genId()
  const row = _split(collectionName, { ...data, id })
  const { error } = await supabase.from(collectionName).insert(row)
  if (error) throw error
  return row[pk]
}

let _auditSesi = null
export function setAuditSesi(s) { _auditSesi = s || null }

async function _backupHapus(collectionName, id, snapshot, alasan, sesi) {
  try {
    const auditId = `del_${collectionName}_${id}_${Date.now()}`
    await supabase.from('audit_log').insert(
      _split('audit_log', {
        id: auditId,
        aksi: 'delete',
        collection: collectionName,
        doc_id: String(id),
        user_id: String(sesi?.id || 'unknown'),
        data_snapshot: snapshot ? JSON.stringify(snapshot).slice(0, 50000) : '',
        alasan: alasan || '',
        user_nama: sesi?.nama || sesi?.guru || 'unknown',
        timestamp: new Date().toISOString()
      })
    )
    return auditId
  } catch (e) {
    console.warn('[db] backup audit_log gagal:', e?.message || e)
    return null
  }
}

export async function deleteOne(collectionName, id, opts = {}) {
  _ensure()
  const { pk } = _cfg(collectionName)
  if (!opts.skipBackup) {
    try {
      const snap = await getOne(collectionName, id)
      if (snap) await _backupHapus(collectionName, id, snap, opts.alasan || '', opts.sesi || _auditSesi)
    } catch (e) { /* backup best-effort */ }
  }
  const { error } = await supabase.from(collectionName).delete().eq(pk, String(id))
  if (error) throw error
}

// ---- realtime / subscribe -------------------------------------------------
export function subscribeColl(collectionName, callback, filters = [], orders = []) {
  _ensure()
  const fetchAll = () =>
    queryColl(collectionName, filters, orders).then(callback)
      .catch((err) => console.error(`[subscribeColl] ${collectionName} error:`, err))
  if (!REALTIME.has(collectionName)) { fetchAll(); return () => {} }
  fetchAll()
  const ch = supabase
    .channel(`rt-${collectionName}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: collectionName }, fetchAll)
    .subscribe()
  return () => { try { supabase.removeChannel(ch) } catch { /* noop */ } }
}

export function subscribeDoc(collectionName, id, callback) {
  _ensure()
  const { pk } = _cfg(collectionName)
  const fetchOne = () =>
    getOne(collectionName, id).then(callback)
      .catch((err) => console.error(`[subscribeDoc] ${collectionName}/${id} error:`, err))
  if (!REALTIME.has(collectionName)) { fetchOne(); return () => {} }
  fetchOne()
  const ch = supabase
    .channel(`rt-${collectionName}-${id}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: collectionName, filter: `${pk}=eq.${id}` }, fetchOne)
    .subscribe()
  return () => { try { supabase.removeChannel(ch) } catch { /* noop */ } }
}

// ---- shim Timestamp Firebase (agar pemanggil lama tak meledak saat cutover) -
export function serverTimestamp() { return new Date().toISOString() }
export const Timestamp = {
  now: () => new Date().toISOString(),
  fromDate: (d) => (d instanceof Date ? d : new Date(d)).toISOString()
}

export const _internal = { flatten: _flatten, split: _split, colRef: _colRef, deepMerge: _deepMerge, cfg: _cfg, COLS, SPECIAL, REALTIME }
