#!/usr/bin/env node
// ============================================================================
// WASEELA — Seed DEMO (data dummy + akun login) via Firebase Admin SDK.
//   Mengisi project SANDBOX demo supaya app tak kosong saat dipamerkan.
//   Admin SDK BYPASS rules — aman menulis tanpa login.
//
// PRASYARAT:
//   1. Punya service account project demo:
//      Firebase Console → Project settings → Service accounts → Generate new private key
//      → simpan JSON-nya (mis. scripts/sa-demo.json — JANGAN commit; sudah di-gitignore).
//   2. Install firebase-admin sekali:  npm i firebase-admin   (di root repo)
//
// PAKAI:
//   node scripts/seed-demo.mjs --key scripts/sa-demo.json [--password demo1234]
//   (atau set GOOGLE_APPLICATION_CREDENTIALS=path lalu tanpa --key)
//   (atau mode ADC: gcloud auth application-default login → node scripts/seed-demo.mjs --project waseela-id)
//
// HASIL: AKUN LOGIN → 1 admin (admin) + 3 guru (login pakai username) +
//   4 santri (login pakai no. WA), semua sandi default "demo1234". Plus data
//   dummy: ~18 santri, tagihan/pembayaran, prestasi, absensi bulanan, 2 postingan, branding.
// ============================================================================
import { readFileSync } from 'fs'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// ---- args ----
const argv = process.argv.slice(2)
function arg(name, def) {
  const i = argv.indexOf('--' + name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const keyPath = arg('key', process.env.GOOGLE_APPLICATION_CREDENTIALS)
const projectArg = arg('project', null)
const ADMIN_PASS = arg('password', 'demo1234')
const ADMIN_USER = 'admin'
// Sandi yang sama dipakai semua akun demo (admin/guru/santri) agar mudah dipamerkan.
const DEMO_PASS = ADMIN_PASS

// ---- init admin: dua mode ----
//   A) --key <sa.json>  → service account (kalau org policy mengizinkan key)
//   B) ADC (default)    → tanpa key. Jalankan dulu: gcloud auth application-default login
//                          lalu: node scripts/seed-demo.mjs --project <projectId>
let projectId
if (keyPath) {
  let serviceAccount
  try {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
  } catch (e) {
    console.error(`✗ Gagal baca service account: ${keyPath}\n  ${e.message}`)
    process.exit(1)
  }
  initializeApp({ credential: cert(serviceAccount) })
  projectId = serviceAccount.project_id
} else {
  projectId = projectArg
  if (!projectId) {
    console.error('✗ Tanpa --key, WAJIB --project <projectId> (mode ADC).')
    console.error('  Setup sekali: gcloud auth application-default login')
    console.error('               gcloud auth application-default set-quota-project <projectId>')
    process.exit(1)
  }
  initializeApp({ credential: applicationDefault(), projectId })
}
const auth = getAuth()
const db = getFirestore()
console.log(`[seed] project: ${projectId}  (mode: ${keyPath ? 'service-account' : 'ADC'})`)

// Password yang DISIMPAN di Auth = padded ('mu_auth_' + sandi) — cocok dgn yang app kirim.
const toAuthPassword = (p) => 'mu_auth_' + String(p || '')
const ADMIN_EMAIL = `${ADMIN_USER}@waseela.local`

// ---- helper ----
// Struktur lembaga + kelas SAMA PERSIS dengan Ammu (Portal MU): mirror DEFAULT_LEMBAGA_SEED
//   di app/src/composables/useLembaga.js (di-inline karena script Node tak bisa import alias '@/…').
//   `group` dibawa apa adanya (seperti Ammu); `tipe` diturunkan karena dibaca app (stats/filter).
const TPQ_KELAS = [
  'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
  'Jilid 2A', 'Jilid 2B', 'Jilid 3A', 'Jilid 3B',
  'Jilid 4A', 'Jilid 4B', 'Jilid 5A', 'Jilid 5B',
  'KPI', 'Persiapan Khotaman'
]
const GROUP_TO_TIPE = { qiraati: 'Qiraati', sekolah: 'Formal', mahad: 'Non Lembaga', 'non-lembaga': 'Non Lembaga' }
const LEMBAGA_SEED = [
  { lembaga: 'Yayasan', group: 'non-lembaga', kelas: [] },
  { lembaga: 'Sarana Prasarana', group: 'non-lembaga', kelas: [] },
  { lembaga: 'TPQ Pagi', group: 'qiraati', tpq_group: 'TPQ', shift: 'pagi', kelas: TPQ_KELAS },
  { lembaga: 'TPQ Sore', group: 'qiraati', tpq_group: 'TPQ', shift: 'sore', kelas: TPQ_KELAS },
  { lembaga: 'Pra PTPT', group: 'qiraati', tpq_group: 'TPQ', kelas: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'] },
  { lembaga: 'PTPT', group: 'qiraati', kelas: ['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'] },
  { lembaga: 'PPPH', group: 'qiraati', kelas: ['Level 1', 'Level 2', 'Level 3', 'Level 4'] },
  { lembaga: "Ma'had", group: 'mahad', kelas: [] },
  { lembaga: 'TK', group: 'sekolah', kelas: ['TK A', 'TK B'] },
  { lembaga: 'SDI', group: 'sekolah', kelas: ['I', 'II', 'III', 'IV', 'V', 'VI'] },
  { lembaga: 'PKBM', group: 'sekolah', kelas: ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'] }
]
// Bentuk dokumen master/lembaga: tambah `tipe` (dibaca app) di atas struktur Ammu.
const LEMBAGA_MASTER = LEMBAGA_SEED.map((l) => ({ ...l, tipe: GROUP_TO_TIPE[l.group] || 'Qiraati' }))
// Pasangan (lembaga, kelas) VALID utk penempatan santri demo — selaras LEMBAGA_MASTER (label Ammu).
const PLACEMENTS = [
  { lembaga: 'TPQ Pagi', kelas: 'Jilid 1A' },
  { lembaga: 'TPQ Pagi', kelas: 'Jilid 3A' },
  { lembaga: 'TPQ Sore', kelas: 'Jilid 2B' },
  { lembaga: 'TPQ Sore', kelas: 'Jilid 5B' },
  { lembaga: 'Pra PTPT', kelas: 'Level 1' },
  { lembaga: 'Pra PTPT', kelas: 'Level 3' },
  { lembaga: 'Pra PTPT', kelas: 'Level 5' },
  { lembaga: 'PTPT', kelas: 'Kelas 1' },
  { lembaga: 'PTPT', kelas: 'Kelas 3' },
  { lembaga: 'PTPT', kelas: 'Kelas 6' },
  { lembaga: 'PPPH', kelas: 'Level 1' },
  { lembaga: 'PPPH', kelas: 'Level 4' }
]
const NAMA_DEPAN = ['Ahmad', 'Muhammad', 'Abdullah', 'Fatimah', 'Aisyah', 'Zainab', 'Umar', 'Ali', 'Hasan', 'Husain', 'Khadijah', 'Maryam', 'Yusuf', 'Ibrahim', 'Ismail', 'Salman', 'Bilal', 'Hamzah']
const NAMA_BELAKANG = ['Al-Faruq', 'Az-Zahra', 'Hidayat', 'Ramadhan', 'Maulana', 'Syafii', 'Anwar', 'Firdaus']
function nama(i) {
  return `${NAMA_DEPAN[i % NAMA_DEPAN.length]} ${NAMA_BELAKANG[i % NAMA_BELAKANG.length]}`
}
function pick(arr, i) {
  return arr[i % arr.length]
}

// Buat / perbarui akun login internal ({localPart}@waseela.local) + set custom claim role.
//   Mengembalikan uid agar bisa di-link ke dokumen guru/santri (linked_uid + firebase_uid).
async function ensureAuthUser(localPart, displayName, role) {
  const email = `${String(localPart).toLowerCase()}@waseela.local`
  let user
  try {
    user = await auth.getUserByEmail(email)
    await auth.updateUser(user.uid, { password: toAuthPassword(DEMO_PASS), displayName })
  } catch {
    user = await auth.createUser({ email, password: toAuthPassword(DEMO_PASS), displayName })
  }
  if (role) await auth.setCustomUserClaims(user.uid, { role })
  return { uid: user.uid, email }
}

async function setupAdmin() {
  let user
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL)
    await auth.updateUser(user.uid, { password: toAuthPassword(ADMIN_PASS) })
    console.log(`[seed] admin sudah ada — password di-reset (${ADMIN_EMAIL})`)
  } catch (e) {
    user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: toAuthPassword(ADMIN_PASS),
      displayName: 'Administrator Demo'
    })
    console.log(`[seed] ✓ akun admin dibuat (${ADMIN_EMAIL})`)
  }
  // Custom claim role → rules (canManage/isSuper) + RBAC tanpa perlu Cloud Function syncUserClaims.
  await auth.setCustomUserClaims(user.uid, { role: 'super_admin' })
  console.log('[seed] ✓ claim role=super_admin di-set')
  return user.uid
}

async function seedSettings() {
  const branding = {
    namaLembaga: 'Waseela',
    namaPondokSingkat: 'Waseela',
    txtAppName: 'Waseela',
    txtHeaderBar: 'Waseela',
    appTitle: 'Waseela — Portal Manajemen',
    motto: 'Portal Digital Pendidikan',
    kopLine1: 'WASEELA',
    kopLine2: 'PORTAL MANAJEMEN LEMBAGA',
    namaChannel: 'Waseela Channel',
    adminUsername: ADMIN_USER
  }
  // settings/web (lookup admin + branding) + settings/general (source of truth app)
  await db.doc('settings/web').set(branding, { merge: true })
  await db.doc('settings/general').set(branding, { merge: true })
  console.log('[seed] ✓ settings/web + settings/general (branding)')
}

async function seedLembaga() {
  await db.doc('master/lembaga').set({ list: LEMBAGA_MASTER }, { merge: true })
  console.log(`[seed] ✓ master/lembaga (${LEMBAGA_MASTER.length} lembaga: Qiraati + Sekolah)`)
}

async function seedGuru() {
  const guru = [
    { id: 'G001', nama: 'Ustadz Abdul Rohman', role_sistem: 'guru_biasa', lembaga: 'TPQ Pagi', jk: 'L', jabatan: 'Kepala TPQ', username: 'rohman', status: 'Aktif' },
    { id: 'G002', nama: 'Ustadzah Siti Aminah', role_sistem: 'guru_biasa', lembaga: 'PTPT', jk: 'P', jabatan: 'PJ PTPT', username: 'aminah', status: 'Aktif' },
    { id: 'G003', nama: 'Ustadz Kepala PPPH', role_sistem: 'admin', lembaga: 'PPPH', jk: 'L', jabatan: 'PJ PPPH', username: 'kepala', status: 'Aktif' }
  ]
  // Buat akun login tiap guru + link uid ke dokumen.
  for (const g of guru) {
    const role =
      g.role_sistem === 'admin' ? 'admin'
      : g.role_sistem === 'admin_keuangan' ? 'admin_keuangan'
      : g.role_sistem === 'super_admin' ? 'super_admin'
      : 'guru'
    const { uid, email } = await ensureAuthUser(g.username, g.nama, role)
    g.linked_uid = uid
    g.firebase_uid = uid
    g.linked_email = email
  }
  const batch = db.batch()
  for (const g of guru) batch.set(db.doc(`guru/${g.id}`), g)
  await batch.commit()
  console.log(`[seed] ✓ ${guru.length} guru (+ akun login: ${guru.map((g) => g.username).join(', ')})`)
  return guru
}

async function seedSantri(n = 18, nLogin = 4) {
  const list = []
  for (let i = 0; i < n; i++) {
    const id = 'S' + String(1001 + i)
    const p = pick(PLACEMENTS, i)
    const s = {
      id,
      nama: nama(i),
      nis: String(2026000 + i),
      lembaga: p.lembaga,
      kelas: p.kelas,
      jk: i % 2 === 0 ? 'L' : 'P',
      wali: 'Bapak/Ibu ' + NAMA_BELAKANG[i % NAMA_BELAKANG.length],
      wa: '0812' + String(10000000 + i),
      aktif: true,
      is_mukim: i % 3 === 0
    }
    list.push(s)
  }
  // Showcase "input tgl ceremonial naik kelas" (PTPT) — isi kartu_kenaikan 1 santri PTPT Kelas 1.
  const ptptSantri = list.find((s) => s.lembaga === 'PTPT')
  if (ptptSantri) {
    ptptSantri.kelas = 'Kelas 1'
    ptptSantri.kartu_kenaikan = {
      PTPT: {
        kelas_1: {
          juz_1: '2026-01-10',
          juz_2: '2026-02-10',
          juz_3: '2026-03-10',
          juz_4: '2026-04-10',
          juz_5: '2026-05-10',
          ceremonial: '2026-05-20'
        }
      }
    }
  }
  // Beri akun login (via no. WA) untuk beberapa santri pertama + link uid.
  for (let i = 0; i < Math.min(nLogin, list.length); i++) {
    const s = list[i]
    const { uid, email } = await ensureAuthUser(s.wa, s.nama, 'santri')
    s.linked_uid = uid
    s.firebase_uid = uid
    s.linked_email = email
  }
  const batch = db.batch()
  for (const s of list) batch.set(db.doc(`santri/${s.id}`), s)
  await batch.commit()
  console.log(`[seed] ✓ ${n} santri (+ akun login utk ${Math.min(nLogin, list.length)} santri pertama, via no. WA)`)
  return list
}

async function seedKeuangan(santri) {
  const batch = db.batch()
  const bulan = '2026-06'
  let nTagih = 0
  let nBayar = 0
  santri.slice(0, 12).forEach((s, i) => {
    const tagihId = `T-${bulan}-${s.id}`
    batch.set(db.doc(`keuangan_tagihan/${tagihId}`), {
      id: tagihId,
      santri_id: s.id,
      santri_nama: s.nama,
      periode: bulan,
      kategori: 'SPP Bulanan',
      nominal: 150000,
      status: i % 3 === 0 ? 'lunas' : 'belum',
      tanggal: '2026-06-01'
    })
    nTagih++
    if (i % 3 === 0) {
      const bayarId = `B-${bulan}-${s.id}`
      batch.set(db.doc(`keuangan_pembayaran/${bayarId}`), {
        id: bayarId,
        santri_id: s.id,
        santri_nama: s.nama,
        tagihan_id: tagihId,
        nominal: 150000,
        tanggal: '2026-06-05',
        metode: 'tunai'
      })
      nBayar++
    }
  })
  // Buku induk (kas) — beberapa entri masuk/keluar
  ;[
    { tipe: 'masuk', nominal: 600000, keterangan: 'Pembayaran SPP', sumber: 'manual' },
    { tipe: 'keluar', nominal: 200000, keterangan: 'Beli ATK', sumber: 'manual' },
    { tipe: 'masuk', nominal: 300000, keterangan: 'Infaq wali', sumber: 'manual' }
  ].forEach((e, i) => {
    const id = `BK-2026-06-${i + 1}`
    batch.set(db.doc(`keuangan_buku_induk/${id}`), { id, tanggal: `2026-06-0${i + 2}`, ...e })
  })
  await batch.commit()
  console.log(`[seed] ✓ keuangan: ${nTagih} tagihan, ${nBayar} pembayaran, 3 kas`)
}

async function seedPrestasi(santri) {
  const batch = db.batch()
  const jenis = ['Hafalan Juz 30', 'Juara Adzan', 'Khotmil Quran', 'Tartil Terbaik']
  santri.slice(0, 6).forEach((s, i) => {
    const id = `PR-${s.id}`
    batch.set(db.doc(`riwayat_prestasi/${id}`), {
      id,
      santri_id: s.id,
      santri_nama: s.nama,
      lembaga: s.lembaga,
      judul: pick(jenis, i),
      periode: '2026-06',
      tanggal: '2026-06-10'
    })
  })
  await batch.commit()
  console.log('[seed] ✓ 6 prestasi')
}

async function seedAbsensi(santri) {
  const batch = db.batch()
  santri.slice(0, 12).forEach((s, i) => {
    const id = `AB-2026-06-${s.id}`
    batch.set(db.doc(`absensi_santri_ngaji_bulanan/${id}`), {
      id,
      santri_id: s.id,
      santri_nama: s.nama,
      lembaga: s.lembaga,
      periode: '2026-06',
      hadir: 20 + (i % 4),
      sakit: i % 5 === 0 ? 1 : 0,
      izin: i % 7 === 0 ? 1 : 0,
      alpa: i % 6 === 0 ? 1 : 0
    })
  })
  await batch.commit()
  console.log('[seed] ✓ 12 absensi ngaji bulanan')
}

async function seedPosts() {
  const posts = [
    { id: 'POST1', judul: 'Selamat Datang di Portal Demo Waseela', isi: 'Ini contoh postingan/pengumuman. Coba nyalakan & matikan fitur lewat panel Demo di pojok kanan-bawah.', tanggal: '2026-06-15' },
    { id: 'POST2', judul: 'Jadwal Ujian Kenaikan Jilid', isi: 'Ujian kenaikan jilid Qiraati akan dilaksanakan pekan depan. Mohon para santri mempersiapkan diri.', tanggal: '2026-06-18' }
  ]
  const batch = db.batch()
  for (const p of posts) {
    batch.set(db.doc(`posts/${p.id}`), p)
    batch.set(db.doc(`beranda_post/${p.id}`), p) // dukung kedua koleksi
  }
  await batch.commit()
  console.log('[seed] ✓ 2 postingan')
}

async function main() {
  await setupAdmin()
  await seedSettings()
  await seedLembaga()
  const guru = await seedGuru()
  const santri = await seedSantri()
  await seedKeuangan(santri)
  await seedPrestasi(santri)
  await seedAbsensi(santri)
  await seedPosts()
  console.log('\n✅ SEED SELESAI. Daftar akun login demo (semua sandi: ' + DEMO_PASS + '):')
  console.log(`   ADMIN   →  ${ADMIN_USER}  (akses penuh / super_admin)`)
  for (const g of guru) {
    console.log(`   GURU    →  ${g.username}  (${g.jabatan} — ${g.lembaga})`)
  }
  santri.slice(0, 4).forEach((s) => {
    console.log(`   SANTRI  →  ${s.wa}  (${s.nama} — ${s.lembaga}, login pakai no. WA)`)
  })
  console.log('   (Panel "Mode Demo" muncul di pojok kanan-bawah untuk pilih fitur.)')
  process.exit(0)
}

main().catch((e) => {
  console.error('\n✗ SEED GAGAL:', e?.message || e)
  process.exit(1)
})
