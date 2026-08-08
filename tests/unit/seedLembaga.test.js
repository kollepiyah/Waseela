import { describe, it, expect } from 'vitest'
import { DEFAULT_LEMBAGA_SEED } from '../../app/src/composables/useLembaga.js'
import { bacaSeedLembaga } from '../../scripts/seed-lembaga.mjs'

// ============================================================================
// Penjaga: skrip seed membaca DEFAULT_LEMBAGA_SEED langsung dari berkas sumber
// (pencocokan kurung), karena useLembaga.js mengimpor Vue/pinia sehingga tak bisa
// di-`import` dari Node biasa. Tes ini memastikan hasil pembacaan itu SAMA PERSIS
// dengan konstanta aslinya — kalau suatu saat bentuk konstantanya berubah (mis.
// memakai pemanggilan fungsi), tes ini gagal sebelum seed sempat menulis data keliru.
// ============================================================================

describe('seed lembaga', () => {
  it('hasil baca skrip identik dengan DEFAULT_LEMBAGA_SEED', () => {
    expect(bacaSeedLembaga()).toEqual(DEFAULT_LEMBAGA_SEED)
  })

  // Label kelas tanpa kurung keterangan — bentuk 'Level 1 (½ Juz)' pernah dipakai dan ditolak.
  it('label kelas tanpa kurung keterangan', () => {
    const semuaKelas = DEFAULT_LEMBAGA_SEED.flatMap((l) => l.kelas || [])
    for (const k of semuaKelas) {
      expect(k, `kelas "${k}" tak boleh memuat kurung keterangan`).not.toMatch(/[()]/)
    }
  })

  // Keputusan Kyai (8 Agu 2026): jenjang Pra PTPT DINAMAI jumlah juz — selaras dengan
  // DEFAULT_KARTU_KENAIKAN_PRA_PTPT di utils/kenaikan.js. PPPH TIDAK ikut berubah.
  it('Pra PTPT dinamai jumlah juz; PPPH tetap Level polos', () => {
    const praPtpt = DEFAULT_LEMBAGA_SEED.find((l) => l.lembaga === 'Pra PTPT')
    expect(praPtpt.kelas).toEqual([
      'Level ½ Juz',
      'Level 1 Juz',
      'Level 1½ Juz',
      'Level 2 Juz',
      'Level 3 Juz'
    ])
    const ppph = DEFAULT_LEMBAGA_SEED.find((l) => l.lembaga === 'PPPH')
    expect(ppph.kelas).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4'])
    const ptpt = DEFAULT_LEMBAGA_SEED.find((l) => l.lembaga === 'PTPT')
    expect(ptpt.kelas).toEqual(['Kelas 1', 'Kelas 2', 'Kelas 3', 'Kelas 4', 'Kelas 5', 'Kelas 6'])
  })

  // Nama jenjang di kelas penempatan harus SAMA PERSIS dengan label kartu kenaikan,
  // supaya kenaikan kelas tak salah cocok.
  it('nama jenjang Pra PTPT sama dengan label kartu kenaikan', async () => {
    const { DEFAULT_KARTU_KENAIKAN_PRA_PTPT } = await import('../../app/src/utils/kenaikan.js')
    const dariKartu = DEFAULT_KARTU_KENAIKAN_PRA_PTPT.kelasList.map((k) => k.label)
    const dariSeed = DEFAULT_LEMBAGA_SEED.find((l) => l.lembaga === 'Pra PTPT').kelas
    expect(dariSeed).toEqual(dariKartu)
  })

  it('paralel Jilid A/B/C dan istilah Khotaman dipertahankan', () => {
    const tpq = DEFAULT_LEMBAGA_SEED.find((l) => l.lembaga === 'TPQ Pagi')
    expect(tpq.kelas).toContain('Jilid 1C')
    expect(tpq.kelas).toContain('Persiapan Khotaman')
  })
})
