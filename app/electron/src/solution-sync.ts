// solution-sync — tarik log absensi LANGSUNG DARI MESIN lewat TCP (protokol ZKTeco).
//
// KENAPA JALUR INI (Kyai, 1 Sep 2026 — mesin pembeli: Solution X609):
//   Jalur Fingerspot (fingerprint-sync.ts) menempel pada APLIKASI BAWAAN — ia membaca
//   database MySQL milik Fingerspot Personnel. Konsekuensinya ada DUA langkah manusia:
//   operator menarik data dari mesin ke PC dulu, baru kita membacanya. Kalau operator
//   lupa, sinkron tetap "berhasil" tapi isinya basi, dan tak ada yang tahu.
//
//   Solution X609 punya TCP/IP (RJ45) dan bicara protokol ZKTeco di port 4370. Jadi
//   aplikasi Desktop bisa menarik LANGSUNG dari mesin — tanpa software bawaan terpasang,
//   tanpa langkah operator. Itu sebabnya jalur ini yang dipilih, bukan membaca
//   att2000.mdb milik software "Attendance Management" bawaannya.
//
// NOL DEPENDENSI, disengaja. Ini port dari `node-zklib` (MIT) — pembingkaian paket TCP,
//   dan pembacaan berbuffer — memakai `net` bawaan Node saja. Alasannya sama dengan
//   fingerprint-sync.ts yang port dari fp_sync.py: cangkang Electron ini dibundel
//   electron-builder, dan tiap dependensi runtime baru adalah satu hal lagi yang bisa
//   gagal di PC pembeli yang tak bisa kita jangkau untuk diperbaiki.
//
// ── BENTUK KELUARAN: JANGAN DIUBAH ─────────────────────────────────────────────────
//   Sengaja SEBANGUN dengan readAttLog() Fingerspot: { device_pin, timestamp } dengan
//   timestamp 'YYYY-MM-DD HH:MM:SS' waktu lokal mesin. Karena bentuknya sama, SELURUH
//   logika aplikasi dipakai ulang apa adanya — derivasi shift, jam pulang, diagnosa
//   "scan tanpa absen" (composables/useFingerprintSync.js). Menambah/mengubah field di
//   sini berarti memecah kesebangunan itu dan melahirkan aturan kembar.
//
// ── JAM MESIN ADALAH SUMBER KEBENARAN ──────────────────────────────────────────────
//   Mesin mengirim waktu DINDING-nya sendiri, tanpa zona waktu. Kita tak menormalkannya
//   ke UTC dan tak menyentuh objek Date sama sekali — komponen tanggal/jam dirakit jadi
//   teks langsung. Kalau jam mesin melenceng, SEMUA absensi ikut melenceng dan tak ada
//   yang bisa dilakukan aplikasi; periksa jam mesin dulu sebelum menyalahkan kode ini.

import * as net from 'net'
import type { AttRow } from './fingerprint-sync'

export interface ZkConfig {
  host: string
  port?: number
  timeoutMs?: number
}

const CMD_CONNECT = 1000
const CMD_EXIT = 1001
const CMD_PREPARE_DATA = 1500
const CMD_DATA = 1501
const CMD_FREE_DATA = 1502
const CMD_DATA_WRRQ = 1503
const CMD_DATA_RDY = 1504
const CMD_REG_EVENT = 500
const CMD_ACK_OK = 2000
const CMD_ACK_UNAUTH = 2005

const EF_ATTLOG = 1
const USHRT_MAX = 65535
const MAX_CHUNK = 65472
const RECORD_SIZE = 40

// fct=1 (att log). Panjang & isi persis seperti yang dikirim aplikasi vendor.
const REQ_ATTLOG = Buffer.from([0x01, 0x0d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

const dua = (n: number) => String(n).padStart(2, '0')

function checksum(buf: Buffer): number {
  let sum = 0
  for (let i = 0; i < buf.length; i += 2) {
    sum += i === buf.length - 1 ? buf[i] : buf.readUInt16LE(i)
    sum %= USHRT_MAX
  }
  return USHRT_MAX - sum - 1
}

/**
 * Bingkai TCP = prefiks 8 byte (magic 0x7d825050 + panjang muatan) + header 8 byte
 * (perintah, checksum, sesi, reply) + data.
 */
function tcpHeader(command: number, sessionId: number, replyId: number, data: Buffer): Buffer {
  const buf = Buffer.alloc(8 + data.length)
  buf.writeUInt16LE(command, 0)
  buf.writeUInt16LE(0, 2)
  buf.writeUInt16LE(sessionId, 4)
  buf.writeUInt16LE(replyId, 6)
  data.copy(buf, 8)
  buf.writeUInt16LE(checksum(buf), 2)

  const prefix = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0x00, 0x00, 0x00, 0x00])
  prefix.writeUInt32LE(buf.length, 4)
  return Buffer.concat([prefix, buf])
}

function stripTcp(buf: Buffer): Buffer {
  if (buf.length < 8) return buf
  if (buf.compare(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 0, 4, 0, 4) !== 0) return buf
  return buf.subarray(8)
}

function decodeHeader(buf: Buffer) {
  const body = buf.subarray(8)
  return {
    payloadSize: buf.readUIntLE(4, 2),
    commandId: body.readUIntLE(0, 2),
    sessionId: body.readUIntLE(4, 2)
  }
}

/**
 * Paket "real-time event" bisa menyelinap di tengah aliran balasan kalau mesin sedang
 * dipakai orang. Ia BUKAN jawaban permintaan kita — kalau ikut disambung ke buffer data,
 * satu scan yang kebetulan terjadi saat sinkron akan merusak seluruh hasil pembacaan.
 */
function isEvent(buf: Buffer): boolean {
  try {
    const b = stripTcp(buf)
    return b.readUIntLE(4, 2) === EF_ATTLOG && b.readUIntLE(0, 2) === CMD_REG_EVENT
  } catch {
    return false
  }
}

/**
 * Waktu ZK = satu bilangan bulat terkemas. Dibongkar persis seperti perangkat mengemasnya:
 * detik→menit→jam→hari(basis 31)→bulan(basis 12)→tahun(+2000). Nilai 0 = slot kosong.
 *
 * Sengaja TIDAK lewat objek Date: `new Date(y, m, d, …)` menafsirkan komponen sebagai waktu
 * lokal PC, lalu pemformatan apa pun bisa menggesernya kembali. Yang kita mau justru jam
 * dinding mesin apa adanya — jadi komponennya langsung dirakit jadi teks.
 */
export function decodeZkTime(v: number): string {
  if (!v) return ''
  let t = v
  const second = t % 60
  t = (t - second) / 60
  const minute = t % 60
  t = (t - minute) / 60
  const hour = t % 24
  t = (t - hour) / 24
  const day = (t % 31) + 1
  t = (t - (day - 1)) / 31
  const month0 = t % 12
  t = (t - month0) / 12
  const year = t + 2000
  if (year < 2000 || year > 2100) return ''
  return `${year}-${dua(month0 + 1)}-${dua(day)} ${dua(hour)}:${dua(minute)}:${dua(second)}`
}

/** Satu catatan absensi = 40 byte: [0..2) urut, [2..11) PIN ascii, [27..31) waktu terkemas. */
export function decodeRecord(rec: Buffer): AttRow | null {
  // PIN rata-kiri lalu dipadatkan NUL sampai 9 byte — potong di NUL pertama.
  const ascii = rec.subarray(2, 11).toString('ascii')
  const nul = ascii.indexOf('\u0000')
  const pin = (nul >= 0 ? ascii.slice(0, nul) : ascii).trim()
  const timestamp = decodeZkTime(rec.readUInt32LE(27))
  if (!pin || !timestamp) return null
  return { device_pin: pin, timestamp }
}

class ZkSocket {
  private socket: net.Socket = null
  private sessionId = 0
  private replyId = 0

  constructor(
    private host: string,
    private port: number,
    private timeoutMs: number
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket()
      const onErr = (err: Error) => reject(err)
      this.socket.once('error', onErr)
      this.socket.once('connect', () => {
        this.socket.removeListener('error', onErr)
        this.socket.on('error', () => {
          /* ditangani per-permintaan lewat timeout */
        })
        // Batas waktu socket HANYA untuk fase menyambung. Sesudah tersambung ia dimatikan:
        // pembacaan berpotong bisa diam beberapa detik di antara potongan, dan idle-timeout
        // bawaan akan menembak di tengah transfer yang sebenarnya sehat. Setiap permintaan
        // sudah punya penjaga waktunya sendiri.
        this.socket.setTimeout(0)
        resolve()
      })
      this.socket.setTimeout(this.timeoutMs, () => {
        this.socket.destroy()
        reject(new Error('Mesin tak menjawab dalam ' + Math.round(this.timeoutMs / 1000) + ' detik.'))
      })
      this.socket.connect(this.port, this.host)
    })
  }

  /** Kirim satu perintah, tunggu satu balasan. */
  private exec(command: number, data: Buffer = Buffer.alloc(0)): Promise<Buffer> {
    if (command === CMD_CONNECT) {
      this.sessionId = 0
      this.replyId = 0
    } else {
      this.replyId++
    }
    const msg = tcpHeader(command, this.sessionId, this.replyId, data)
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout = null
      const onData = (buf: Buffer) => {
        if (isEvent(buf)) return
        clearTimeout(timer)
        this.socket.removeListener('data', onData)
        const body = stripTcp(buf)
        if (command === CMD_CONNECT && body.length >= 8) {
          this.sessionId = body.readUInt16LE(4)
        }
        resolve(body)
      }
      this.socket.on('data', onData)
      this.socket.write(msg, (err) => {
        if (err) {
          this.socket.removeListener('data', onData)
          reject(err)
          return
        }
        timer = setTimeout(() => {
          this.socket.removeListener('data', onData)
          reject(new Error('mesin tak menjawab perintah ' + command))
        }, this.timeoutMs)
      })
    })
  }

  async sesi(): Promise<void> {
    const reply = await this.exec(CMD_CONNECT)
    const cmd = reply.readUIntLE(0, 2)
    if (cmd === CMD_ACK_UNAUTH) {
      throw new Error('Mesin menolak koneksi: ia meminta comm key. Kosongkan di menu mesin.')
    }
    if (cmd !== CMD_ACK_OK) {
      throw new Error('Mesin menjawab tapi menolak membuka sesi (kode ' + cmd + ')')
    }
  }

  /** Minta mesin melepas buffer data sisa permintaan sebelumnya. */
  freeData(): Promise<Buffer> {
    return this.exec(CMD_FREE_DATA)
  }

  private chunkRequest(start: number, size: number): void {
    this.replyId++
    const req = Buffer.alloc(8)
    req.writeUInt32LE(start, 0)
    req.writeUInt32LE(size, 4)
    this.socket.write(tcpHeader(CMD_DATA_RDY, this.sessionId, this.replyId, req))
  }

  /**
   * Baca data besar. Mesin menjawab salah satu dari dua cara:
   *   CMD_DATA               → datanya langsung menyatu di balasan (log kecil).
   *   CMD_ACK_OK/PREPARE_DATA→ mesin menyiapkan buffer & memberi UKURANNYA; kita lalu
   *                            memintanya per-potong 64KB (CMD_DATA_RDY).
   * X609 berkapasitas 50.000 transaksi, jadi jalur potongan inilah yang biasa terpakai.
   */
  readBuffered(reqData: Buffer): Promise<Buffer> {
    this.replyId++
    const msg = tcpHeader(CMD_DATA_WRRQ, this.sessionId, this.replyId, reqData)

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout = null
      let awal = Buffer.alloc(0)

      const gagal = (e: Error) => {
        clearTimeout(timer)
        this.socket.removeListener('data', onFirst)
        reject(e)
      }

      const onFirst = (buf: Buffer) => {
        if (isEvent(buf)) return
        awal = Buffer.concat([awal, buf])
        if (awal.length < 16) return // header belum utuh
        clearTimeout(timer)
        this.socket.removeListener('data', onFirst)

        const head = decodeHeader(awal)

        if (head.commandId === CMD_DATA) {
          // Data menyatu. Tunggu sejenak kalau-kalau masih ada lanjutannya.
          let sisa = awal
          const lanjut = (b: Buffer) => {
            if (isEvent(b)) return
            sisa = Buffer.concat([sisa, b])
            reset()
          }
          let t: NodeJS.Timeout = null
          const reset = () => {
            clearTimeout(t)
            t = setTimeout(() => {
              this.socket.removeListener('data', lanjut)
              resolve(sisa.subarray(16))
            }, 800)
          }
          this.socket.on('data', lanjut)
          reset()
          return
        }

        if (head.commandId !== CMD_ACK_OK && head.commandId !== CMD_PREPARE_DATA) {
          reject(new Error('mesin menolak permintaan data (kode ' + head.commandId + ')'))
          return
        }

        // Mode buffer: 4 byte sesudah 1 byte penanda = ukuran total data.
        const size = awal.subarray(16).readUIntLE(1, 4)
        if (!size) {
          resolve(Buffer.alloc(0))
          return
        }

        const remain = size % MAX_CHUNK
        const numberChunks = (size - remain) / MAX_CHUNK
        let sisaPaket = numberChunks + (remain > 0 ? 1 : 0)

        let hasil = Buffer.alloc(0)
        let buffer = Buffer.alloc(0)
        let potongan = Buffer.alloc(0)
        let jam: NodeJS.Timeout = null

        const selesai = (err?: Error) => {
          clearTimeout(jam)
          this.socket.removeListener('data', onChunk)
          if (err) reject(err)
          else resolve(hasil)
        }
        const perpanjang = () => {
          clearTimeout(jam)
          jam = setTimeout(
            () => selesai(new Error(`putus di tengah — ${sisaPaket} potong data belum tiba`)),
            this.timeoutMs
          )
        }

        const onChunk = (b: Buffer) => {
          if (isEvent(b)) return
          perpanjang()
          buffer = Buffer.concat([buffer, b])
          // Satu paket utuh = 8 byte prefiks + payloadSize.
          for (;;) {
            if (buffer.length < 8) break
            const panjang = buffer.readUIntLE(4, 2)
            if (buffer.length < 8 + panjang) break
            potongan = Buffer.concat([potongan, buffer.subarray(16, 8 + panjang)])
            buffer = buffer.subarray(8 + panjang)

            const penuh = sisaPaket > 1 ? MAX_CHUNK + 8 : remain + 8
            if (potongan.length === penuh) {
              hasil = Buffer.concat([hasil, potongan.subarray(8)])
              potongan = Buffer.alloc(0)
              sisaPaket--
              if (sisaPaket <= 0) {
                selesai()
                return
              }
            }
          }
        }

        this.socket.on('data', onChunk)
        perpanjang()
        for (let i = 0; i <= numberChunks; i++) {
          if (i === numberChunks) {
            if (remain > 0) this.chunkRequest(numberChunks * MAX_CHUNK, remain)
          } else {
            this.chunkRequest(i * MAX_CHUNK, MAX_CHUNK)
          }
        }
      }

      this.socket.on('data', onFirst)
      this.socket.write(msg, (err) => {
        if (err) {
          gagal(err)
          return
        }
        timer = setTimeout(() => gagal(new Error('mesin tak menjawab permintaan log')), this.timeoutMs)
      })
    })
  }

  async tutup(): Promise<void> {
    try {
      await this.exec(CMD_EXIT)
    } catch {
      /* mesin kadang menutup duluan — bukan kegagalan */
    }
    try {
      this.socket && this.socket.destroy()
    } catch {
      /* ignore */
    }
    this.socket = null
  }
}

/**
 * Baca seluruh log scan dari mesin.
 *
 * SENGAJA TIDAK memanggil CMD_DISABLEDEVICE. Aplikasi vendor mematikan mesin selama
 * transfer, dan itu masuk akal untuk tarikan manual sekali sehari. Di sini sinkron
 * berjalan BERKALA di latar: kalau proses mati di tengah — PC di-restart, kabel dicabut,
 * Electron ditutup — mesin akan TERTINGGAL DALAM KEADAAN MATI dan guru tak bisa absen
 * sampai ada yang sadar. Membaca tanpa mematikan bekerja normal; paket scan yang masuk
 * di tengah pembacaan sudah disaring isEvent().
 *
 * @returns [{ device_pin, timestamp }] — bentuk yang sama dengan readAttLog() Fingerspot.
 */
export async function readZkAttLog(config: ZkConfig): Promise<AttRow[]> {
  const host = String(config?.host || '').trim()
  if (!host) throw new Error('Alamat IP mesin belum diisi.')
  const port = Number(config?.port) || 4370
  const timeoutMs = Number(config?.timeoutMs) || 10000

  const zk = new ZkSocket(host, port, timeoutMs)
  try {
    await zk.connect()
  } catch (e: any) {
    const kode = e && e.code
    if (kode === 'ETIMEDOUT' || kode === 'EHOSTUNREACH' || kode === 'ENETUNREACH') {
      throw new Error(`Mesin ${host}:${port} tak terjangkau — pastikan PC ini sejaringan dengannya.`)
    }
    if (kode === 'ECONNREFUSED') {
      throw new Error(`Mesin ${host} menolak sambungan di port ${port} — periksa nomor portnya.`)
    }
    throw new Error(`Gagal menyambung ke ${host}:${port} — ${(e && e.message) || e}`)
  }

  try {
    await zk.sesi()
    // Buffer sisa sinkron sebelumnya (mis. yang putus di tengah) harus dilepas dulu,
    // kalau tidak mesin menjawab permintaan baru dengan data lama.
    await zk.freeData().catch(() => undefined)
    const data = await zk.readBuffered(REQ_ATTLOG)
    await zk.freeData().catch(() => undefined)

    // 4 byte pertama = jumlah byte data; catatannya menyusul 40 byte per baris.
    let sisa = data.subarray(4)
    const rows: AttRow[] = []
    while (sisa.length >= RECORD_SIZE) {
      const row = decodeRecord(sisa.subarray(0, RECORD_SIZE))
      if (row) rows.push(row)
      sisa = sisa.subarray(RECORD_SIZE)
    }
    rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    return rows
  } finally {
    await zk.tutup()
  }
}

// CLI uji ke mesin sungguhan — dipakai SEBELUM merilis, karena mesinnya ada di tempat
// pembeli dan tak bisa dijangkau dari sini:
//   node build/solution-sync.js 192.168.1.201 [port]
if (require.main === module) {
  const host = process.argv[2]
  const port = Number(process.argv[3]) || 4370
  if (!host) {
    console.error('pakai: node build/solution-sync.js <ip-mesin> [port]')
    process.exit(1)
  }
  readZkAttLog({ host, port })
    .then((rows) => {
      console.log('SCAN terbaca:', rows.length)
      for (const r of rows.slice(-10)) console.log('  ', r.device_pin, r.timestamp)
    })
    .catch((e) => {
      console.error('ERR', (e && e.message) || e)
      process.exit(1)
    })
}
