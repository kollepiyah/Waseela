// ============================================================================
// KOP header image (baris PERTAMA semua kop surat) — WHITE-LABEL, per-tenant.
//
// Sumber gambar = SETTING/tenant (`settings.kopImageUrl`), di-inject via setKopImage()
// dari stores/settings. TIDAK ada aset hardcoded lagi. Default = null → SEMUA renderer
// jatuh ke fallback TEKS `kopLine1` (dari settings/branding tenant). Jadi lembaga baru
// TIDAK menampilkan kaligrafi lembaga lain — tinggal isi kopLine1 atau unggah gambar KOP.
//
// (Sebelumnya v.100 meng-hardcode kaligrafi 1 lembaga tertentu di src/assets — dibuang
//  demi white-label. Nama fungsi/ekspor dipertahankan agar 7 consumer tak perlu diubah.)
//
// Consumer: raporPdf, pdfBuilder, strukBuilder, escpImage, receiptHtml, RaporView,
//   RekapPrestasiView. Semua sudah punya cabang fallback-teks bila gambar null.
//
// MUASSIS_URL & MUASSIS_RATIO = LIVE BINDING (export let) — di-update setKopImage()/
// saat gambar ter-load, jadi consumer yang mengimpornya ikut nilai terbaru otomatis.
import { imageToDataURL } from '@/services/pdf'

const DEFAULT_RATIO = 2998 / 332 // fallback rasio (≈9.03) sebelum gambar ter-ukur

export let MUASSIS_URL = null            // URL/dataURL gambar KOP aktif (null = tak ada)
export let MUASSIS_RATIO = DEFAULT_RATIO // lebar/tinggi; di-update saat gambar ter-load
export function kopImageRatio() { return MUASSIS_RATIO }

let _srcUrl = null
let _dataUrl = null
let _loading = null
let _img = null

// Dipanggil stores/settings saat settings dimuat/berubah. url kosong → matikan gambar.
export function setKopImage(url) {
  const u = url || null
  if (u === _srcUrl) return
  _srcUrl = u
  MUASSIS_URL = u
  _dataUrl = null
  _loading = null
  _img = null
  MUASSIS_RATIO = DEFAULT_RATIO
  if (_srcUrl) { muassisDataUrl(); muassisImageSync() } // pre-warm cache + ukur rasio
}

// dataURL (cached) untuk jsPDF addImage & HTML print window. null bila gambar tak di-set.
export function muassisDataUrl() {
  if (!_srcUrl) return Promise.resolve(null)
  if (_dataUrl) return Promise.resolve(_dataUrl)
  if (!_loading) {
    _loading = imageToDataURL(_srcUrl)
      .then((d) => { _dataUrl = d || null; return _dataUrl })
      .catch(() => null)
  }
  return _loading
}
// Sinkron untuk builder HTML — null bila belum siap / tak di-set (→ fallback teks).
export function muassisDataUrlSync() { return _dataUrl }

// HTMLImageElement (cached) untuk canvas (escpImage) — null bila belum load / tak di-set.
export function muassisImageSync() {
  if (!_srcUrl || typeof Image === 'undefined') return null
  if (!_img) {
    _img = new Image()
    _img.onload = () => {
      if (_img.naturalHeight > 0) MUASSIS_RATIO = _img.naturalWidth / _img.naturalHeight
    }
    _img.src = _srcUrl
  }
  if (_img.complete && _img.naturalWidth > 0) {
    if (_img.naturalHeight > 0) MUASSIS_RATIO = _img.naturalWidth / _img.naturalHeight
    return _img
  }
  return null
}
