// gedung.js — dimensi "Gedung" (penataan administrasi: scope keuangan + akademik).
// SUMBER TUNGGAL daftar gedung default + helper. Field santri `gedung` disimpan di
// kolom ekor jsonb `data` (TANPA migration), diisi MANUAL via form / template impor.
// Lihat memori project_keuangan_gedung. (v.111)

// Tak ada gedung bawaan: nama gedung itu milik LEMBAGA, bukan milik aplikasi.
// Repo asal mengisinya dengan nama gedung lembaganya sendiri, sehingga di pemasangan
// baru daftar itu muncul seolah-olah milik pembeli. Admin mengisinya sendiri lewat
// Master Data > Gedung. Kosong = penataan per-gedung tak dipakai (semua lihat semua).
export const DEFAULT_GEDUNG = []

// Daftar gedung aktif dari settings.
//
// ⚠ Array KOSONG dihormati apa adanya — JANGAN dianggap "belum diisi".
//   Syarat lama `arr.length ? arr : DEFAULT` membuat gedung TERAKHIR mustahil dihapus:
//   begitu daftarnya kosong, nilai bawaan muncul lagi seolah penghapusan gagal.
//   Persoalan yang sama pernah terjadi pada master JABATAN dan sudah diperbaiki di
//   JabatanKelolaView dengan cara ini juga: hanya `undefined` yang berarti "belum diisi".
export function gedungList(settings) {
  const arr = settings && settings.gedung_list
  if (Array.isArray(arr)) return arr.filter(Boolean)
  return DEFAULT_GEDUNG.slice()
}

// ---- scope (dipakai Fase 3 keuangan + Fase 4 akademik) --------------------
// Kas (= gedung) yang menampung keuangan seorang santri. '' bila belum di-assign.
export function kasForSantri(s) {
  return String((s && s.gedung) || '').trim()
}

// Gedung yang dikelola/ditempati seorang user (sesiAktif). '' bila tak ada.
export function gedungOf(sesi) {
  return String((sesi && sesi.gedung) || '').trim()
}

// Apakah user terikat scope gedung. super_admin / admin built-in (id 'admin') =
// lihat SEMUA → tidak ter-scope. User lain ter-scope HANYA bila punya gedung.
export function isGedungScoped(sesi) {
  if (!sesi) return false
  if (sesi.id === 'admin' || sesi.role_sistem === 'super_admin') return false
  return !!gedungOf(sesi)
}

// Apakah user berhak atas santri ini menurut scope gedung.
// User tak ter-scope (super_admin / tanpa gedung) → true (lihat semua).
export function gedungScopeMatches(sesi, santri) {
  if (!isGedungScoped(sesi)) return true
  return kasForSantri(santri) === gedungOf(sesi)
}
