/** @type {import('tailwindcss').Config} */
// v.20.0526: Tailwind config Vue 3 SPA
// - darkMode 'class': toggle via classList di <html> (initDarkFromStorage di ui.js)
// - content: scan SEMUA file Vue/JS supaya purge utility classes yang dipakai
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['"Scheherazade New"', 'serif']
      },

      // ── WARNA MEREK: palet `teal` DIPETAKAN ke emerald Waseela ──────────────
      //
      // Warna logo Waseela = #065F46 (diukur dari 50.917 piksel berwarna pada
      // brand-assets/logo.png), sedangkan repo asal memakai teal (#0F766E).
      //
      // Kenapa MEMETAKAN palet, bukan mengganti 1308 pemakaian kelas satu per satu:
      // perubahan terpusat di satu berkas, mudah ditinjau, dan mudah dibalik. Kelas
      // `teal-*` di komponen dibiarkan apa adanya supaya berkas yang ditarik dari
      // hulu tetap bisa disalin tanpa penyesuaian — itulah yang menjaga sync tetap murah.
      //
      // Nuansa 700 sengaja = warna logo PERSIS: itu nuansa yang paling banyak dipakai
      // (287 kali, terbanyak di seluruh aplikasi) dan memang berperan sebagai warna
      // utama tombol/header. Sisanya mengikuti tangga emerald bawaan Tailwind.
      //
      // ⚠ Nama kelasnya tetap "teal" walau warnanya emerald. Mengganti namanya berarti
      //   menyunting 1308 tempat dan membuat setiap sync dari hulu bertabrakan.
      colors: {
        teal: {
          50: '#ecfdf5', // emerald-50
          100: '#d1fae5', // emerald-100
          200: '#a7f3d0', // emerald-200
          300: '#6ee7b7', // emerald-300
          400: '#34d399', // emerald-400
          500: '#10b981', // emerald-500
          600: '#059669', // emerald-600
          700: '#065f46', // ← WARNA LOGO WASEELA (emerald-800)
          800: '#064e3b', // emerald-900
          900: '#043d2f', // lebih gelap, agar 800→900 tetap berjenjang
          950: '#022c22' // emerald-950
        }
      }
    }
  },
  plugins: []
}
