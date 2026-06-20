#!/usr/bin/env node
// ============================================================================
// WASEELA — Seed DEMO (data dummy + akun admin) via Firebase Admin SDK.
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
//
// HASIL: akun admin (username "adminmu", sandi default "demo1234") + ~3 guru,
//   ~18 santri, tagihan/pembayaran, prestasi, absensi bulanan, 2 postingan, branding.
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
const ADMIN_USER = 'adminmu'

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
const ADMIN_EMAIL = `${ADMIN_USER}@ammu.local`

// ---- helper ----
const LEMBAGA = ['TPQ', 'Madin Awaliyah', 'Madin Wustho']
const KELAS = ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Al-Quran', 'Ula 1', 'Ula 2']
const NAMA_DEPAN = ['Ahmad', 'Muhammad', 'Abdullah', 'Fatimah', 'Aisyah', 'Zainab', 'Umar', 'Ali', 'Hasan', 'Husain', 'Khadijah', 'Maryam', 'Yusuf', 'Ibrahim', 'Ismail', 'Salman', 'Bilal', 'Hamzah']
const NAMA_BELAKANG = ['Al-Faruq', 'Az-Zahra', 'Hidayat', 'Ramadhan', 'Maulana', 'Syafii', 'Anwar', 'Firdaus']
function nama(i) {
  return `${NAMA_DEPAN[i % NAMA_DEPAN.length]} ${NAMA_BELAKANG[i % NAMA_BELAKANG.length]}`
}
function pick(arr, i) {
  return arr[i % arr.length]
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
    namaLembaga: 'Pondok Pesantren Waseela',
    namaPondokSingkat: 'Waseela',
    txtAppName: 'Waseela',
    txtHeaderBar: 'Waseela',
    appTitle: 'Waseela — Portal Pesantren',
    motto: 'Satu aplikasi untuk seluruh pesantren',
    kopLine1: 'PONDOK PESANTREN WASEELA',
    kopLine2: 'PORTAL MANAJEMEN PESANTREN',
    namaChannel: 'Waseela Channel',
    adminUsername: ADMIN_USER
  }
  // settings/web (lookup admin + branding) + settings/general (source of truth app)
  await db.doc('settings/web').set(branding, { merge: true })
  await db.doc('settings/general').set(branding, { merge: true })
  console.log('[seed] ✓ settings/web + settings/general (branding)')
}

async function seedGuru() {
  const guru = [
    { id: 'G001', nama: 'Ustadz Abdul Rohman', role_sistem: 'guru_biasa', lembaga: 'TPQ', jk: 'L', jabatan: 'Guru Qiraati', username: 'rohman', status: 'Aktif' },
    { id: 'G002', nama: 'Ustadzah Siti Aminah', role_sistem: 'guru_biasa', lembaga: 'Madin Awaliyah', jk: 'P', jabatan: 'Wali Kelas', username: 'aminah', status: 'Aktif' },
    { id: 'G003', nama: 'Ustadz Kepala Madin', role_sistem: 'admin', lembaga: 'Madin Wustho', jk: 'L', jabatan: 'Kepala Madin', username: 'kepala', status: 'Aktif' }
  ]
  const batch = db.batch()
  for (const g of guru) batch.set(db.doc(`guru/${g.id}`), g)
  await batch.commit()
  console.log(`[seed] ✓ ${guru.length} guru`)
  return guru
}

async function seedSantri(n = 18) {
  const batch = db.batch()
  const list = []
  for (let i = 0; i < n; i++) {
    const id = 'S' + String(1001 + i)
    const s = {
      id,
      nama: nama(i),
      nis: String(2026000 + i),
      lembaga: pick(LEMBAGA, i),
      kelas: pick(KELAS, i),
      jk: i % 2 === 0 ? 'L' : 'P',
      wali: 'Bapak/Ibu ' + NAMA_BELAKANG[i % NAMA_BELAKANG.length],
      wa: '0812' + String(10000000 + i),
      aktif: true,
      is_mukim: i % 3 === 0
    }
    list.push(s)
    batch.set(db.doc(`santri/${id}`), s)
  }
  await batch.commit()
  console.log(`[seed] ✓ ${n} santri`)
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
  await seedGuru()
  const santri = await seedSantri()
  await seedKeuangan(santri)
  await seedPrestasi(santri)
  await seedAbsensi(santri)
  await seedPosts()
  console.log('\n✅ SEED SELESAI.')
  console.log(`   Login demo →  username: ${ADMIN_USER}   sandi: ${ADMIN_PASS}`)
  console.log('   (Panel "Mode Demo" muncul di pojok kanan-bawah untuk pilih fitur.)')
  process.exit(0)
}

main().catch((e) => {
  console.error('\n✗ SEED GAGAL:', e?.message || e)
  process.exit(1)
})
