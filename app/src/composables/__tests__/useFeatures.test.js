// ============================================================================
// Unit test feature-flags (WASEELA white-label) — useFeatures.js
//   useFeatures membaca tenant.config.js SAAT MODULE LOAD, jadi tiap skenario
//   me-mock '@/tenant.config.js' lalu re-import modul (vi.resetModules).
// ============================================================================
import { describe, it, expect, vi, afterEach } from 'vitest'

// Helper: muat ulang useFeatures dengan set `features` tertentu.
async function loadWith(features) {
  vi.resetModules()
  vi.doMock('@/tenant.config.js', () => ({ default: { features } }))
  return await import('@/composables/useFeatures.js')
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('@/tenant.config.js')
})

describe('isOn — default & explicit', () => {
  it('default ON bila key tak dicantumkan di config', async () => {
    const { isOn } = await loadWith({})
    expect(isOn('posts')).toBe(true)
    expect(isOn('keuangan')).toBe(true)
  })

  it('OFF bila di-set false eksplisit', async () => {
    const { isOn } = await loadWith({ posts: false })
    expect(isOn('posts')).toBe(false)
  })

  it('key kosong/null → true (tak menggerbang)', async () => {
    const { isOn } = await loadWith({})
    expect(isOn('')).toBe(true)
    expect(isOn(null)).toBe(true)
    expect(isOn(undefined)).toBe(true)
  })
})

describe('isOn — parent-inheritance', () => {
  it('keuangan OFF → semua anak (pos/tabungan/bisyaroh/hutangPiutang) OFF', async () => {
    const { isOn } = await loadWith({ keuangan: false })
    expect(isOn('pos')).toBe(false)
    expect(isOn('tabungan')).toBe(false)
    expect(isOn('bisyaroh')).toBe(false)
    expect(isOn('hutangPiutang')).toBe(false)
  })

  it('anak true TAPI parent OFF → tetap OFF (parent menang)', async () => {
    const { isOn } = await loadWith({ keuangan: false, pos: true })
    expect(isOn('pos')).toBe(false)
  })

  it('absensi OFF → fingerprint OFF', async () => {
    const { isOn } = await loadWith({ absensi: false })
    expect(isOn('fingerprint')).toBe(false)
  })

  it('parent ON + anak ON → ON', async () => {
    const { isOn } = await loadWith({ keuangan: true, pos: true })
    expect(isOn('pos')).toBe(true)
  })
})

describe('featureForPath — peta path → flag', () => {
  it('path eksak ter-map', async () => {
    const { featureForPath } = await loadWith({})
    expect(featureForPath('/laporan')).toBe('analitik')
    expect(featureForPath('/psb')).toBe('psb')
    expect(featureForPath('/bisyaroh')).toBe('bisyaroh')
  })

  it('sub-path ikut segmen pertama', async () => {
    const { featureForPath } = await loadWith({})
    expect(featureForPath('/psb/123')).toBe('psb')
    expect(featureForPath('/keuangan/abc/def')).toBe('keuangan')
  })

  it('path tak dikenal / kosong → null', async () => {
    const { featureForPath } = await loadWith({})
    expect(featureForPath('/dashboard')).toBe(null)
    expect(featureForPath('')).toBe(null)
    expect(featureForPath(null)).toBe(null)
  })
})
