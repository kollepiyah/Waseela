// att-mdb-sync — baca log scan dari database software "Attendance Management" (ZKTeco).
//
// KENAPA ADA (Kyai, 2 Sep 2026 — pembeli memasang software ini di PC-nya):
//   Ini jalur KETIGA, dan sengaja jadi CADANGAN, bukan pengganti solution-sync.ts.
//   Kelemahannya sama persis dengan jalur Fingerspot: ia menempel pada APLIKASI VENDOR,
//   jadi datanya hanya sesegar tarikan terakhir operator dari mesin ke PC. Kalau operator
//   lupa, sinkron tetap "berhasil" tapi isinya basi dan tak ada yang tahu.
//
//   Yang ditutupnya: saat PC pembeli TAK sejaringan dengan mesin (mesin ditarik lewat
//   flashdisk, atau mesinnya di gedung lain), jalur TCP 4370 mati total dan satu-satunya
//   sisa dulu adalah impor berkas manual. Sekarang, selama software bawaannya terpasang
//   dan pernah dipakai menarik data, aplikasi bisa membaca hasilnya sendiri.
//
//   Kalau PC-nya sejaringan dengan mesin, PAKAI solution-sync.ts — bukan ini.
//
// NOL DEPENDENSI, disengaja — alasannya sama dengan dua modul saudaranya. Database-nya
//   Microsoft Access (att2000.mdb), dan penyedia Jet 4.0 sudah BAWAAN Windows: tak ada
//   yang perlu dipasang di PC pembeli. Tapi Jet cuma ada dalam rupa 32-bit sedangkan
//   Electron 64-bit, jadi ia tak bisa dimuat in-process. Kita menumpang PowerShell 32-bit
//   di SysWOW64 sebagai pembaca — pola yang sama dengan fingerprint-sync.ts memanggil
//   mysqld sekali-pakai.
//
// ── LOCALE ADALAH JEBAKANNYA, BUKAN KECEPATAN ──────────────────────────────────────
//   Diukur 2 Sep 2026 di att2000.mdb berisi 18.000 baris (setahun, 30 guru):
//
//     rakit dari komponen   0,3 dtk → 2026-01-01 06:32:11   BENAR
//     Recordset.GetString   0,1 dtk → 01/01/2026 06.32.11   rusak
//     Format() di dalam SQL 0,1 dtk → 2026-01-01 06.32.11   rusak
//
//   Windows berbahasa Indonesia memakai '.' sebagai pemisah jam, dan DUA cara cepat itu
//   memformat tanggal lewat locale mesin — termasuk Format() milik Jet, yang menukar ':'
//   di pola format dengan pemisah locale. Hasilnya tetap "tanggal yang masuk akal", cuma
//   tak bisa diurai splitTs() di useFingerprintSync — jadi SELURUH scan diam-diam hilang.
//
//   Karena itu komponen tanggal/jam diambil satu per satu lalu DIRAKIT JADI TEKS, dan
//   skripnya memaksa culture invariant. Sikap yang sama dengan decodeZkTime() di
//   solution-sync.ts. JANGAN menukarnya dengan GetString demi 0,2 detik.
//
// ── BENTUK KELUARAN: JANGAN DIUBAH ─────────────────────────────────────────────────
//   Sebangun dengan readAttLog() Fingerspot & readZkAttLog() Solution:
//   { device_pin, timestamp } dengan timestamp 'YYYY-MM-DD HH:MM:SS' waktu dinding mesin.
//   Karena bentuknya sama, SELURUH logika aplikasi dipakai ulang apa adanya — derivasi
//   shift, jam pulang, diagnosa "scan tanpa absen" (composables/useFingerprintSync.js).
//
// ── PIN ADA DI TABEL SEBELAH ───────────────────────────────────────────────────────
//   Beda halus dari Fingerspot yang gampang meleset: att_log Fingerspot menyimpan PIN
//   mesin langsung di kolom `pin`. Di sini CHECKINOUT.USERID adalah nomor urut INTERNAL
//   database — PIN yang diketik guru di mesin ada di USERINFO.BADGENUMBER. Tanpa JOIN,
//   yang tercocokkan ke guru.id_fingerprint adalah angka yang salah, dan SEMUA scan masuk
//   sebagai "PIN tak dikenal".
//
//   Kolom CHECKTYPE (masuk/pulang) SENGAJA DIABAIKAN — sama dengan sikap utils/scanMesin.js:
//   mesin menandai semua scan sama kalau operator tak menekan F1/F2, jadi menentukan
//   masuk/pulang dari JAM + master shift lebih jujur.

import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { AttRow } from './fingerprint-sync'

export interface AttMdbConfig {
  // Lokasi att2000.mdb. Kosong = lokasi bawaan pemasangan Attendance Management.
  mdbPath?: string
}

const DEFAULT_MDB = 'C:\\Program Files (x86)\\Attendance Management\\att2000.mdb'

/**
 * PowerShell 32-bit — satu-satunya cangkang yang bisa memuat Jet 4.0 dari proses 64-bit.
 *
 * SysWOW64 TIDAK kena pengalihan sistem berkas (yang dialihkan hanya System32), jadi path
 * ini benar baik dipanggil dari proses 64-bit maupun 32-bit. Di Windows 32-bit map
 * SysWOW64 tak ada sama sekali — di sana System32 memang sudah 32-bit.
 */
function powershell32(): string {
  const win = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const wow = path.join(win, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (fs.existsSync(wow)) return wow
  const sys = path.join(win, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (fs.existsSync(sys)) return sys
  throw new Error('PowerShell tak ketemu di ' + win + ' — jalur ini hanya jalan di Windows.')
}

/** Kutip untuk literal string PowerShell bertanda kutip tunggal. */
function kutipPs(s: string): string {
  return "'" + String(s).replace(/'/g, "''") + "'"
}

// JOIN wajib — lihat catatan "PIN ADA DI TABEL SEBELAH" di kepala berkas.
const SQL_SCAN =
  'SELECT u.BADGENUMBER, c.CHECKTIME FROM CHECKINOUT c ' +
  'INNER JOIN USERINFO u ON c.USERID = u.USERID ORDER BY c.CHECKTIME'

/**
 * Skrip pembaca. Dituliskan ke berkas lalu dijalankan dengan -File: menghindari neraka
 * kutip kalau path pembeli memuat spasi atau tanda petik.
 */
function skripPs(mdb: string): string {
  return [
    '$ErrorActionPreference = "Stop"',
    // Kunci culture SEBELUM apa pun diformat — lihat catatan LOCALE di kepala berkas.
    '[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture',
    '$mdb = ' + kutipPs(mdb),
    '$cn = New-Object -ComObject ADODB.Connection',
    '$cn.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$mdb;")',
    'try {',
    '  $rs = New-Object -ComObject ADODB.Recordset',
    '  $rs.Open(' + kutipPs(SQL_SCAN) + ', $cn, 0, 1)',
    '  $tab = [char]9',
    '  $sb = New-Object System.Text.StringBuilder',
    '  while (-not $rs.EOF) {',
    '    $pin = ([string]$rs.Fields.Item(0).Value).Trim()',
    '    $d = $rs.Fields.Item(1).Value',
    '    if ($pin -and $d) {',
    '      $waktu = "{0:0000}-{1:00}-{2:00} {3:00}:{4:00}:{5:00}" -f ' +
      '$d.Year, $d.Month, $d.Day, $d.Hour, $d.Minute, $d.Second',
    '      $null = $sb.Append($pin).Append($tab).AppendLine($waktu)',
    '    }',
    '    $rs.MoveNext()',
    '  }',
    '  $rs.Close()',
    '  [Console]::Out.Write($sb.ToString())',
    '} finally {',
    '  $cn.Close()',
    '}'
  ].join('\r\n')
}

/**
 * Urai keluaran skrip → [{ device_pin, timestamp }].
 *
 * MURNI & diekspor supaya bisa diuji tanpa Windows, tanpa Jet, tanpa berkas .mdb — bagian
 * inilah yang menentukan scan tercocokkan atau hilang diam-diam. Baris cacat DIBUANG,
 * bukan diteruskan setengah jadi: satu baris rusak tak boleh menggagalkan seluruh sinkron,
 * tapi juga tak boleh menjelma jadi absensi hantu.
 */
export function parseBarisAttMdb(out: string): AttRow[] {
  const rows: AttRow[] = []
  for (const ln of String(out || '').split(/\r?\n/)) {
    if (!ln) continue
    const tab = ln.indexOf('\t')
    if (tab < 1) continue
    const device_pin = ln.slice(0, tab).trim()
    const timestamp = ln.slice(tab + 1).trim()
    if (!device_pin) continue
    // Penjaga locale: pemisah jam yang berubah jadi '.' tertangkap DI SINI, bukan diam-diam
    // lolos lalu gagal dicocokkan splitTs() jauh di hilir.
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) continue
    rows.push({ device_pin, timestamp })
  }
  return rows
}

/**
 * Terjemahkan galat Jet/PowerShell jadi kalimat yang menyebut apa yang harus diperiksa.
 *
 * DUA hal yang wajib dibersihkan sebelum apa pun sampai ke layar pembeli:
 *   - PowerShell melampirkan jejak baris ('At C:\...\baca.ps1:5 char:1 + $cn.Open(...)').
 *     Itu bicara soal isi perut kita, bukan soal yang bisa diperbuat pembeli.
 *   - Galat Jet menyebut SALINAN di folder sementara. Path itu sudah terhapus saat pesan
 *     terbaca, jadi menampilkannya cuma mengirim orang memeriksa berkas yang tak ada.
 */
function pesanRamah(mentah: string, mdb: string, salinan: string): string {
  let s = String(mentah || '').split(/\r?\n/)[0].trim()
  if (salinan) s = s.split(salinan).join(mdb)
  if (/provider cannot be found|tidak dapat ditemukan/i.test(s)) {
    return 'Penyedia Microsoft.Jet.OLEDB.4.0 tak tersedia di PC ini — biasanya sudah bawaan Windows.'
  }
  if (/unrecognized database format|not a valid database/i.test(s)) {
    return (
      'Berkas ' + mdb + ' bukan database Access — pastikan yang ditunjuk memang att2000.mdb.'
    )
  }
  if (/CHECKINOUT|USERINFO/i.test(s)) {
    return (
      'Tabel CHECKINOUT/USERINFO tak ada di ' +
      mdb +
      ' — berkas ini sepertinya bukan database Attendance Management.'
    )
  }
  if (/password/i.test(s)) {
    return 'Database ' + mdb + ' terkunci sandi — jalur ini hanya bisa membaca yang tanpa sandi.'
  }
  if (/cannot find|not a valid path|could not find/i.test(s)) {
    return 'Berkas tak terbaca: ' + mdb + ' — periksa lokasi pemasangan Attendance Management.'
  }
  return s.slice(0, 300)
}

/**
 * Baca seluruh log scan dari att2000.mdb → [{ device_pin, timestamp }].
 *
 * MDB-nya DISALIN dulu ke folder sementara, baru dibaca. Tiga sebab, semuanya nyata:
 *   1. Jet membuat berkas kunci .ldb DI SEBELAH database. Di Program Files itu berarti
 *      menulis ke folder milik admin — kalau tidak, Windows mengalihkannya diam-diam ke
 *      VirtualStore.
 *   2. Membuka dengan Mode=Read gagal 'Could not lock file' (diuji 2 Sep 2026), jadi tak
 *      ada cara membuka in-place tanpa berpotensi menyentuh berkas vendor.
 *   3. Salinan tak bisa mengganggu aplikasi bawaan yang mungkin sedang membukanya.
 */
export async function readAttMdbLog(config: AttMdbConfig = {}): Promise<AttRow[]> {
  const mdb = String(config?.mdbPath || '').trim() || DEFAULT_MDB
  if (!fs.existsSync(mdb)) {
    throw new Error(
      'Berkas ' + mdb + ' tak ketemu — periksa lokasi pemasangan Attendance Management.'
    )
  }
  const ps = powershell32()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'att_mdb_'))
  const salinan = path.join(tmp, 'att.mdb')
  const skrip = path.join(tmp, 'baca.ps1')

  try {
    try {
      fs.copyFileSync(mdb, salinan)
    } catch (e: any) {
      throw new Error(
        'Gagal menyalin ' +
          mdb +
          ' — ' +
          ((e && e.message) || e) +
          '. Tutup aplikasi bawaannya lalu ulangi.'
      )
    }
    fs.writeFileSync(skrip, skripPs(salinan), 'utf8')

    const out = await new Promise<string>((resolve, reject) => {
      execFile(
        ps,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', skrip],
        { timeout: 120000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          // Toleran seperti fingerprint-sync: kalau ADA stdout, pakai — sebagian galat COM
          // menulis ke stderr padahal datanya sudah keluar utuh.
          if (err && !stdout) {
            reject(new Error(pesanRamah(String(stderr || err.message || ''), mdb, salinan)))
          } else resolve(String(stdout || ''))
        }
      )
    })
    return parseBarisAttMdb(out)
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch (e) {
      /* ignore */
    }
  }
}

// CLI uji — memisahkan soal database dari soal aplikasi, sama gunanya dengan uji
// solution-sync:  node build/att-mdb-sync.js ["C:\path\att2000.mdb"]
if (require.main === module) {
  const arg = process.argv[2]
  readAttMdbLog(arg ? { mdbPath: arg } : {})
    .then((rows) => {
      console.log('SCAN terbaca:', rows.length)
      for (const r of rows.slice(-10)) console.log('  ', r.device_pin, r.timestamp)
    })
    .catch((e) => {
      console.error('ERR', (e && e.message) || e)
      process.exit(1)
    })
}
