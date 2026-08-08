import { describe, it, expect } from 'vitest'
import { BRAND, FIREBASE_CONFIG } from '../../app/src/config/brand.js'
import { POLA_JEJAK } from '../../scripts/whitelabel-rules.mjs'

// ============================================================================
// GERBANG WHITE-LABEL — versi otomatis dari "uji settings kosong".
//
// Kenapa ini ada: sebagian besar identitas di kode hulu berbentuk FALLBACK
// (`settings.kopLine1 || '<nama pesantren>'`). Fallback hanya muncul ketika baris
// settings pembeli masih kosong — persis keadaan hari pertama pemakaian, dan justru
// saat itulah kop surat pertama dicetak. Tes ini mengunci keadaan tersebut supaya
// kebocoran tak bisa kembali diam-diam lewat sync berikutnya.
// ============================================================================

describe('BRAND — identitas produk', () => {
  it('tak memuat jejak identitas lembaga lain', () => {
    for (const [k, v] of Object.entries(BRAND)) {
      if (typeof v !== 'string') continue
      expect(POLA_JEJAK.test(v), `BRAND.${k} = ${JSON.stringify(v)}`).toBe(false)
    }
  })

  it('nama produk = Waseela, hak cipta = Bakafrawi Project', () => {
    expect(BRAND.appName).toBe('Waseela')
    expect(BRAND.copyrightName).toBe('BAKAFRAWI PROJECT')
  })

  // Ini inti janji "pembeli tinggal isi sendiri": bidang identitas LEMBAGA dikirim
  // KOSONG. Kosong = renderer melewati barisnya, jadi tak ada nama lembaga asing
  // yang ikut tercetak sebelum pembeli mengisi Pengaturan.
  it('bidang identitas lembaga dikirim KOSONG', () => {
    expect(BRAND.kopLine1).toBe('')
    expect(BRAND.kopLine2).toBe('')
    expect(BRAND.kopImageUrl).toBe('')
    expect(BRAND.motto).toBe('')
  })

  it('project Firebase bukan milik lembaga lain', () => {
    for (const [k, v] of Object.entries(FIREBASE_CONFIG)) {
      expect(POLA_JEJAK.test(String(v)), `FIREBASE_CONFIG.${k}`).toBe(false)
    }
  })
})
