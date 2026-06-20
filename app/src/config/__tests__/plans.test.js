// ============================================================================
// Unit test resolusi paket (plans.js) — resolveFeatures.
// ============================================================================
import { describe, it, expect } from 'vitest'
import { resolveFeatures, PLANS, ALL_FEATURES } from '@/config/plans.js'

describe('resolveFeatures — backward-compat (tanpa plan)', () => {
  it('tanpa plan → pakai `features` apa adanya', () => {
    const f = resolveFeatures({ features: { keuangan: false, posts: true } })
    expect(f).toEqual({ keuangan: false, posts: true })
  })

  it('config kosong → objek kosong', () => {
    expect(resolveFeatures({})).toEqual({})
    expect(resolveFeatures()).toEqual({})
  })
})

describe('resolveFeatures — preset paket', () => {
  it('basic → hanya modul basic ON, sisanya OFF', () => {
    const f = resolveFeatures({ plan: 'basic' })
    for (const key of ALL_FEATURES) {
      expect(f[key]).toBe(PLANS.basic.includes(key))
    }
    expect(f.keuangan).toBe(false)
    expect(f.absensi).toBe(true)
  })

  it('premium → semua modul ON', () => {
    const f = resolveFeatures({ plan: 'premium' })
    for (const key of ALL_FEATURES) expect(f[key]).toBe(true)
  })

  it('plan tak dikenal → semua OFF', () => {
    const f = resolveFeatures({ plan: 'enterprise-ngawur' })
    for (const key of ALL_FEATURES) expect(f[key]).toBe(false)
  })
})

describe('isi paket (intent bisnis)', () => {
  it('fitur lembaga sekolah (rapor + absensiSekolah): Pro & Premium, TIDAK Basic', () => {
    for (const f of ['rapor', 'absensiSekolah']) {
      expect(PLANS.basic.includes(f)).toBe(false)
      expect(PLANS.pro.includes(f)).toBe(true)
      expect(PLANS.premium.includes(f)).toBe(true)
    }
  })

  it('Basic punya prestasi + kenaikan/tes-kenaikan, tapi bukan keuangan', () => {
    expect(PLANS.basic.includes('prestasi')).toBe(true)
    expect(PLANS.basic.includes('kenaikan')).toBe(true)
    expect(PLANS.basic.includes('keuangan')).toBe(false)
  })

  it('kegiatanPesantren: HANYA Premium (bukan Basic/Pro)', () => {
    expect(PLANS.basic.includes('kegiatanPesantren')).toBe(false)
    expect(PLANS.pro.includes('kegiatanPesantren')).toBe(false)
    expect(PLANS.premium.includes('kegiatanPesantren')).toBe(true)
  })

  it('paket bertingkat: basic ⊂ pro ⊂ premium', () => {
    expect(PLANS.basic.every((k) => PLANS.pro.includes(k))).toBe(true)
    expect(PLANS.pro.every((k) => PLANS.premium.includes(k))).toBe(true)
  })
})

describe('resolveFeatures — à la carte (featureOverrides)', () => {
  it('override menyalakan modul di luar preset', () => {
    const f = resolveFeatures({ plan: 'basic', featureOverrides: { analitik: true } })
    expect(f.analitik).toBe(true) // di luar basic, tapi dinyalakan
    expect(f.absensi).toBe(true) // tetap dari preset
  })

  it('override mematikan modul bawaan preset', () => {
    const f = resolveFeatures({ plan: 'pro', featureOverrides: { keuangan: false } })
    expect(f.keuangan).toBe(false)
    expect(f.posts).toBe(true) // bawaan pro tetap ON
  })
})
