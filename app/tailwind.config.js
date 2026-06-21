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
      // WASEELA: brand = EMERALD (menggantikan teal lama). Remap palet `teal`
      // bawaan Tailwind → emerald, supaya SEMUA class `teal-*` (165 pemakaian)
      // ikut hijau dari SATU sumber, tanpa edit per-file.
      colors: {
        teal: {
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
          800: '#065F46', 900: '#064E3B', 950: '#022C22'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['"Scheherazade New"', 'serif']
      }
    }
  },
  plugins: []
}
