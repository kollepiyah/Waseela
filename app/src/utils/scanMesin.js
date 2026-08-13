// scanMesin — baca berkas ekspor mesin absensi (LOG SCAN MENTAH) → baris absensi.
//
// KENAPA ADA (Kyai, 13 Agu 2026 — mesin pembeli: Solution X609):
//   Importer lama menuntut berkas yang sudah berbentuk jadi: kolom `tanggal`, `jam`,
//   `fingerprint_id`, dan `shift` (pagi/sore). Tak ada mesin yang mengekspor kolom
//   SHIFT — yang keluar dari mesin adalah log mentah (PIN, nama, tanggal, jam),
//   beberapa baris sehari (masuk, pulang, kadang scan dobel). Akibatnya jalur impor
//   itu hanya jalan kalau berkasnya dirapikan manual lebih dulu.
//
//   Modul ini menutup jarak itu: log apa adanya masuk, shift + jam masuk + jam pulang
//   diturunkan aplikasi. Berlaku untuk merek apa pun (Solution, ZKTeco, dll) selama
//   ekspornya memuat identitas (PIN atau nama) + tanggal + jam.
//
// ATURAN SHIFT TETAP MILIK APLIKASI: derivasi memakai `utils/shiftDerive.js` — mesin
//   yang SAMA dengan sinkron Fingerspot (useFingerprintSync). Jadi hasil impor dan
//   hasil sinkron otomatis sebangun, tak ada aturan kembar yang bisa berbeda diam-diam.
//
// Kolom "Status"/"Verifikasi"/"In-Out" dari mesin SENGAJA DIABAIKAN: banyak mesin
//   (termasuk X609) menandai semua scan sebagai jenis yang sama kalau operatornya tak
//   menekan tombol F1/F2. Menentukan masuk/pulang dari JAM + master shift lebih jujur.
//
// Semua fungsi MURNI — tanpa I/O, tanpa store. Penulisan ke DB ada di pemanggil.

import { deriveShift, statusFor, shiftsForGuru, pilihShiftPulang } from './shiftDerive'
import { normHHMM } from './shiftMaster'

// ── Pengenalan kolom ────────────────────────────────────────────────────────
// Nama kolom dinormalkan dulu (huruf kecil, semua yang bukan huruf/angka dibuang),
// jadi 'No. ID', 'no_id', dan 'NO ID' sama-sama cocok dengan 'noid'.
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const KOL_PIN = [
  'pin',
  'noid',
  'idkaryawan',
  'nokaryawan',
  'employeeno',
  'employeeid',
  'userid',
  'usercode',
  'acno',
  'enrollno',
  'enrollid',
  'fingerprintid',
  'idfingerprint',
  'fpid',
  'nopin',
  'nip',
  'id'
]
const KOL_NAMA = ['nama', 'namakaryawan', 'namalengkap', 'name', 'employeename', 'guru', 'pegawai']
const KOL_TANGGAL = ['tanggal', 'tgl', 'date', 'tanggalabsen', 'tglabsen', 'scandate']
const KOL_JAM = ['jam', 'waktu', 'time', 'jamscan', 'jamabsen', 'clock', 'scantime']
// Satu kolom berisi tanggal + jam sekaligus (bentuk paling umum di ekspor mesin).
const KOL_WAKTU = [
  'datetime',
  'datetime1',
  'tanggaljam',
  'tanggalwaktu',
  'waktuabsen',
  'waktuscan',
  'timestamp',
  'checktime',
  'scantime',
  'logtime',
  'attendancetime'
]
const KOL_SHIFT = ['shift', 'shiftkerja', 'jadwal']

/** Ambil nilai kolom pertama yang cocok dari daftar kandidat. `undefined` bila nihil. */
function ambil(row, kandidat) {
  if (!row || typeof row !== 'object') return undefined
  for (const key of Object.keys(row)) {
    const k = norm(key)
    if (!k) continue
    if (kandidat.includes(k)) {
      const v = row[key]
      if (v !== null && v !== undefined && String(v).trim() !== '') return v
    }
  }
  return undefined
}

const dua = (n) => String(n).padStart(2, '0')

/**
 * Serial Excel (hari sejak 1899-12-30) → Date UTC.
 * ExcelJS mengembalikan Date untuk sel bertipe tanggal, tapi berkas hasil ekspor
 * mesin kerap menyimpannya sebagai ANGKA biasa — dua-duanya harus terbaca.
 */
function dariSerial(n) {
  const ms = Math.round((Number(n) - 25569) * 86400000)
  return new Date(ms)
}

/**
 * Nilai apa pun → 'YYYY-MM-DD'. '' bila tak masuk akal.
 *
 * Objek Date dibaca dengan getter UTC — ExcelJS menyusun tanggal sel di UTC; memakai
 * getter lokal akan menggeser jamnya sebesar offset zona (di WIB: 07:12 jadi 14:12).
 *
 * Ambigu 'DD/MM' vs 'MM/DD': bila salah satu bagian > 12 dialah penentunya; bila
 * dua-duanya ≤ 12 dianggap HARI dulu (bentuk Indonesia, yang dipakai mesin di sini).
 */
export function normalTanggal(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    return `${v.getUTCFullYear()}-${dua(v.getUTCMonth() + 1)}-${dua(v.getUTCDate())}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v < 1) return '' // pecahan murni = jam saja, bukan tanggal
    return normalTanggal(dariSerial(v))
  }
  const s = String(v).trim()
  if (!s) return ''
  // buang bagian jam bila kolomnya gabungan
  const inti = s.split(/[T ]/)[0]
  let m = inti.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return `${m[1]}-${dua(m[2])}-${dua(m[3])}`
  m = inti.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) {
    let [, a, b, y] = m
    let hari = Number(a)
    let bulan = Number(b)
    if (hari <= 12 && bulan > 12) {
      // bentuk Amerika (MM/DD) — satu-satunya bacaan yang sah di sini
      hari = Number(b)
      bulan = Number(a)
    }
    if (hari < 1 || hari > 31 || bulan < 1 || bulan > 12) return ''
    const tahun = y.length === 2 ? 2000 + Number(y) : Number(y)
    return `${tahun}-${dua(bulan)}-${dua(hari)}`
  }
  return ''
}

/** Nilai apa pun → 'HH:MM'. '' bila tak masuk akal. Detik dibuang (tak dipakai). */
export function normalJam(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    return `${dua(v.getUTCHours())}:${dua(v.getUTCMinutes())}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const pecahan = v - Math.floor(v)
    const menit = Math.round(pecahan * 1440)
    if (menit >= 1440) return ''
    return `${dua(Math.floor(menit / 60))}:${dua(menit % 60)}`
  }
  const s = String(v).trim()
  if (!s) return ''
  // kolom gabungan 'YYYY-MM-DD HH:MM:SS' → ambil ekornya
  const bagian = s.split(/[T ]/)
  const jam = bagian.length > 1 ? bagian[bagian.length - 1] : bagian[0]
  const m = jam.match(/^(\d{1,2})[:.](\d{1,2})/)
  if (!m) return ''
  const h = Number(m[1])
  const mnt = Number(m[2])
  if (h > 23 || mnt > 59) return ''
  return normHHMM(`${h}:${mnt}`) || ''
}

/**
 * Apakah sebuah nilai SUNGGUH memuat jam?
 *
 * Penjaga sederhana tapi penting: sel tanggal-saja selalu bisa dibaca sebagai
 * '00:00'. Tanpa penjaga ini, berkas yang jam-nya memang tak ada akan lolos dengan
 * jam palsu 00:00 — masuk ke shift mana pun yang windownya kebetulan mencakupnya.
 */
function punyaJam(v) {
  if (v === null || v === undefined) return false
  if (v instanceof Date) return !Number.isNaN(v.getTime()) && (v.getUTCHours() || v.getUTCMinutes())
  if (typeof v === 'number') return Number.isFinite(v) && v - Math.floor(v) > 0
  return /\d{1,2}[:.]\d{2}/.test(String(v))
}

/**
 * Satu baris berkas → { pin, nama, tanggal, jam }. `null` bila tak terbaca.
 *
 * Tanggal & jam dicari dari kolomnya masing-masing dulu, lalu dari kolom gabungan,
 * lalu dari kolom "sebelah" — sebagian mesin menaruh 'YYYY-MM-DD HH:MM:SS' utuh di
 * bawah judul `Waktu` (kolom jam) atau `Tanggal`, bukan di kolom bernama datetime.
 */
export function bacaBarisScan(row) {
  const pin = String(ambil(row, KOL_PIN) ?? '').trim()
  const nama = String(ambil(row, KOL_NAMA) ?? '').trim()
  if (!pin && !nama) return null

  const nTanggal = ambil(row, KOL_TANGGAL)
  const nJam = ambil(row, KOL_JAM)
  const nGabung = ambil(row, KOL_WAKTU)

  const tanggal =
    normalTanggal(nTanggal) || normalTanggal(nGabung) || normalTanggal(nJam) || ''
  const jam =
    (punyaJam(nJam) && normalJam(nJam)) ||
    (punyaJam(nGabung) && normalJam(nGabung)) ||
    (punyaJam(nTanggal) && normalJam(nTanggal)) ||
    ''

  if (!tanggal || !jam) return null
  return { pin, nama, tanggal, jam }
}

/** Berkas ini bentuk LAMA (sudah punya kolom shift) atau log mentah? */
export function adaKolomShift(rows) {
  return (Array.isArray(rows) ? rows : []).some((r) => ambil(r, KOL_SHIFT) !== undefined)
}

/** Peta pencarian guru: PIN (id_fingerprint) lebih dulu, nama sebagai cadangan. */
function petaGuru(guruList) {
  const byPin = {}
  const byNama = {}
  for (const g of Array.isArray(guruList) ? guruList : []) {
    const pin = String(g?.id_fingerprint || g?.fingerprint_id || g?.fp_id || '').trim()
    if (pin) byPin[pin] = g
    const nm = String(g?.nama || '')
      .toLowerCase()
      .trim()
    if (nm && !byNama[nm]) byNama[nm] = g
  }
  return { byPin, byNama }
}

/**
 * Log scan mentah → baris absensi siap tulis.
 *
 * Aturannya CERMIN useFingerprintSync (yang sudah dipakai jalur Fingerspot):
 *   - scan TERAWAL yang jatuh di window shift = jam masuk shift itu;
 *   - semua scan lain hari itu jadi kandidat PULANG (termasuk yang masih di dalam
 *     window shift-nya sendiri — pulang sebelum shift bubar tetap tercatat);
 *   - pulang menempel ke shift yang paling belakangan dimasuki, ambil yang TERAKHIR.
 *
 * @param {Array<object>} rows berkas ekspor mesin apa adanya
 * @param {Array<object>} guruList daftar guru (butuh `id`, `nama`, `id_fingerprint`)
 * @param {object} settings settings aplikasi (master shift)
 * @returns {{
 *   total:number, terbaca:number, ditolak:number,
 *   masuk:Array<{docId:string,guru_id:string,guru_nama:string,tanggal:string,shift:string,jam:string,status:string}>,
 *   pulang:Array<{docId:string,guru_id:string,tanggal:string,shift:string,jam_pulang:string}>,
 *   takKenal:string[], tanpaWindow:Array<{nama:string,tanggal:string,jam:string[],sebab:string}>
 * }}
 */
export function rangkumScanMentah(rows, guruList, settings) {
  const daftar = Array.isArray(rows) ? rows : []
  const { byPin, byNama } = petaGuru(guruList)

  const agg = {} // guruId|tanggal|shift → { g, tanggal, shift, jam }
  const kandidatPulang = {} // guruId|tanggal → { g, tanggal, jam:[] }
  const luarPer = {} // guruId|tanggal → { g, tanggal, jam:[] }
  const takKenal = new Set()
  let terbaca = 0
  let ditolak = 0

  const catatPulang = (g, tanggal, jam) => {
    const k = g.id + '|' + tanggal
    if (!kandidatPulang[k]) kandidatPulang[k] = { g, tanggal, jam: [] }
    kandidatPulang[k].jam.push(jam)
  }

  for (const row of daftar) {
    const s = bacaBarisScan(row)
    if (!s) {
      ditolak++
      continue
    }
    terbaca++
    const g =
      (s.pin && byPin[s.pin]) || (s.nama && byNama[s.nama.toLowerCase()]) || null
    if (!g) {
      takKenal.add(s.pin || s.nama)
      continue
    }
    const shift = deriveShift(s.jam, g, settings)
    if (!shift) {
      const k = g.id + '|' + s.tanggal
      if (!luarPer[k]) luarPer[k] = { g, tanggal: s.tanggal, jam: [] }
      luarPer[k].jam.push(s.jam)
      catatPulang(g, s.tanggal, s.jam)
      continue
    }
    const key = g.id + '|' + s.tanggal + '|' + shift
    if (!agg[key]) {
      agg[key] = { g, tanggal: s.tanggal, shift, jam: s.jam }
      continue
    }
    if (s.jam < agg[key].jam) {
      catatPulang(g, s.tanggal, agg[key].jam) // yang lama turun jadi kandidat pulang
      agg[key] = { g, tanggal: s.tanggal, shift, jam: s.jam }
    } else {
      catatPulang(g, s.tanggal, s.jam)
    }
  }

  // ── Baris MASUK ──
  const masuk = []
  const perGuruTanggal = {} // guruId|tanggal → [{shift, jam, status}]
  for (const key of Object.keys(agg)) {
    const a = agg[key]
    const status = statusFor(a.jam, a.shift, settings)
    masuk.push({
      docId: `shift_${a.g.id}_${a.tanggal}_${a.shift}`,
      guru_id: a.g.id,
      guru_nama: a.g.nama || '',
      tanggal: a.tanggal,
      shift: a.shift,
      jam: a.jam,
      status
    })
    const gk = a.g.id + '|' + a.tanggal
    if (!perGuruTanggal[gk]) perGuruTanggal[gk] = []
    perGuruTanggal[gk].push({ shift: a.shift, jam: a.jam, status })
  }

  // ── Baris PULANG ──
  // Hanya menempel pada baris masuk yang lahir dari berkas ini. Baris masuk yang
  // sudah ada di DB (mis. hari yang sama diimpor dua kali) diurus pemanggil.
  const pulang = []
  for (const k of Object.keys(kandidatPulang)) {
    const { g, tanggal, jam } = kandidatPulang[k]
    const barisMasuk = perGuruTanggal[g.id + '|' + tanggal] || []
    if (!barisMasuk.length) continue
    const maxPer = {}
    for (const t of jam) {
      for (const sh of pilihShiftPulang(t, barisMasuk, settings)) {
        if (!maxPer[sh] || t > maxPer[sh]) maxPer[sh] = t
      }
    }
    for (const sh of Object.keys(maxPer)) {
      pulang.push({
        docId: `shift_${g.id}_${tanggal}_${sh}`,
        guru_id: g.id,
        tanggal,
        shift: sh,
        jam_pulang: maxPer[sh]
      })
    }
  }

  // ── Diagnosa: punya scan tapi NOL baris masuk hari itu ──
  // Sebab tersering: shift guru belum diisi, atau jam mesin melenceng dari window.
  const tanpaWindow = Object.keys(luarPer)
    .filter((k) => !perGuruTanggal[k])
    .map((k) => {
      const v = luarPer[k]
      const punyaShift = shiftsForGuru(v.g, settings).size > 0
      return {
        nama: v.g.nama || v.g.id,
        tanggal: v.tanggal,
        jam: [...v.jam].sort(),
        sebab: punyaShift ? 'jam di luar window shift' : 'guru belum punya shift'
      }
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama))

  return {
    total: daftar.length,
    terbaca,
    ditolak,
    masuk,
    pulang,
    takKenal: [...takKenal],
    tanpaWindow
  }
}
