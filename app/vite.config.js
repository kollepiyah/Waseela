import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

// v.1.2.9: versi app tersedia di kode sebagai __APP_VERSION__ — dulu diketik ulang
//   sebagai teks di LoginView, dan nama berkas installer di URL unduhan ikut
//   ditebak manual. Satu sumber = satu titik bump yang berkurang.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
)

// ── .env.local WAJIB MENANG atas variabel lingkungan ────────────────────────
// Perilaku BAWAAN Vite justru sebaliknya: "variabel yang sudah ada saat Vite
// dijalankan berprioritas tertinggi dan TIDAK ditimpa berkas .env".
//
// 8 Agu 2026 itu memakan korban: VITE_SUPABASE_URL basi warisan proses induk
// (menunjuk project lembaga LAIN) mengalahkan app/.env.local, sehingga bundel
// Waseela memanggang URL + anon key milik lembaga itu. Kalau sampai ter-deploy:
// aplikasi pembeli menyambung ke database orang lain, dan kunci anon lembaga itu
// tersiar di bundel publik. Gejalanya pun tak kelihatan — build "sukses".
//
// Karena itu nilai dari berkas di-INJEKSI lewat `define` (penggantian teks
// langsung) yang mengalahkan segalanya. Kalau berkasnya tak ada — misalnya build
// di CI — perilaku bawaan Vite dibiarkan seperti semula.
function envDariBerkas() {
  const p = fileURLToPath(new URL('./.env.local', import.meta.url))
  if (!existsSync(p)) return {}
  const out = {}
  for (const baris of readFileSync(p, 'utf8').split('\n')) {
    const m = baris.match(/^\s*(?:export\s+)?(VITE_[A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}
const envBerkas = envDariBerkas()
const defineEnv = Object.fromEntries(
  Object.entries(envBerkas).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])
)
// Kunci yang TAK ada di berkas tapi ADA di lingkungan → dikosongkan, supaya nilai
// basi tak menyelinap lewat celah itu (mis. .env.local memakai PUBLISHABLE_KEY
// sedangkan lingkungan masih menyimpan ANON_KEY project lama).
if (Object.keys(envBerkas).length) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('VITE_SUPABASE') && !(k in envBerkas)) {
      defineEnv[`import.meta.env.${k}`] = JSON.stringify('')
    }
  }
}

// Vue 3 SPA — Waseela
// Dev: npm run dev  → http://localhost:5174
// Build: npm run build → dist/ (akan di-deploy ke Firebase Hosting nanti)
export default defineConfig({
  // Hosting: Vue di-deploy ke site Firebase Hosting (root)
  // waseela.web.app/ → app/dist/ → base path '/' (SPA at root)
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    ...defineEnv // .env.local menang atas variabel lingkungan — lihat catatan di atas
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174, // beda dari vue-widgets (default 5173) supaya bisa jalan paralel
    open: false
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // v.86.0526: pisah vendor besar dari index (sebelumnya index ~825KB / gzip 216KB).
        //   firebase + chart.js jadi chunk sendiri supaya initial load lebih ringan & cache-friendly.
        //
        // AUDIT AGU 2026 (P1) — pemisahan lama BOCOR dua arah:
        //   1. Aturan `id.includes('jspdf')` cuma memindahkan berkas jsPDF SENDIRI.
        //      DEPENDENSINYA (html2canvas 197kB, canvg 80kB + core-js 45kB/svg-pathdata/
        //      rgbcolor/stackblur, dompurify 22kB) tetap jatuh ke 'vendor' = chunk BOOT.
        //      Sama utk @kurkle/color (dep chart.js) dan vue-advanced-cropper (cuma
        //      dipakai ProfilPengaturanSaya).
        //   2. Helper interop CJS + preload-helper Vite (modul VIRTUAL, tanpa
        //      'node_modules' di id-nya) ditaruh rollup di 'vendor-pdf', lalu 'vendor'
        //      meng-import-nya => `Circular chunk: vendor-pdf -> vendor -> vendor-pdf`
        //      => index.html modulepreload vendor-pdf => jsPDF 391kB TETAP ikut muat
        //      awal walau semua pemakaiannya dynamic import. (Terbukti di live: berkas
        //      vendor-pdf ter-unduh 104kB di halaman login.)
        //
        // Perbaikan: (a) helper virtual dipaku ke 'vendor' supaya arah dependensi
        // cuma satu (vendor-pdf -> vendor); (b) anggota chunk lazy tak lagi didaftar
        // manual tapi DITURUNKAN dari importer — sebuah paket ikut pindah HANYA bila
        // SELURUH jalur importernya berasal dari akar lazy yang sama. Begitu ia juga
        // dipakai jalur boot, ia otomatis tinggal di 'vendor'. Jadi upgrade dependensi
        // tak bisa diam-diam menyeret muatan baru ke jalur boot.
        manualChunks(id, { getModuleInfo }) {
          // (a) Helper lintas-chunk: WAJIB di chunk boot, jangan sampai chunk lazy
          //     yang "memiliki"-nya (itu yang bikin siklus di atas).
          if (
            id.includes('commonjsHelpers') ||
            id.includes('vite/preload-helper') ||
            id.includes('vite/modulepreload-polyfill')
          )
            return 'vendor'
          if (!id.includes('node_modules')) return

          // Akar chunk: paket yang dikenali langsung dari nama berkasnya.
          const rootOf = (mid) => {
            if (mid.includes('firebase/messaging') || mid.includes('@firebase/messaging'))
              return 'vendor-fcm'
            if (mid.includes('firebase') || mid.includes('@firebase')) return 'vendor-firebase'
            if (mid.includes('chart.js') || mid.includes('vue-chartjs')) return 'vendor-charts'
            // jspdf/exceljs/cropper DIPAKAI hanya lewat dynamic import (cetak/ekspor/
            // ganti foto) — boleh berat asal tak ikut boot.
            if (mid.includes('jspdf')) return 'vendor-pdf'
            if (mid.includes('exceljs')) return 'vendor-excel'
            if (mid.includes('vue-advanced-cropper')) return 'vendor-cropper'
            return null
          }

          const own = rootOf(id)
          if (own) return own

          // (b) Bukan akar: telusuri KE ATAS, kumpulkan SEMUA akar yang bisa mencapai
          //     modul ini. Sengaja himpunan (union), bukan keputusan per-jalur: internal
          //     core-js saling impor melingkar, dan penelusuran per-jalur menyerah di
          //     siklus lalu jatuh ke 'vendor' — itu yang dulu menyandera 123 modul
          //     core-js (29,6 kB) di chunk boot padahal cuma dipakai canvg/jsPDF.
          const rootsReaching = (start) => {
            const roots = new Set()
            const seen = new Set([start])
            const stack = [start]
            while (stack.length) {
              const info = getModuleInfo(stack.pop())
              const importers = [...(info?.importers || []), ...(info?.dynamicImporters || [])]
              if (importers.length === 0) {
                roots.add('vendor') // yatim: aman-kan ke boot
                continue
              }
              for (const imp of importers) {
                const r = rootOf(imp)
                if (r)
                  roots.add(r) // sampai di paket akar — berhenti di sini
                else if (!imp.includes('node_modules'))
                  roots.add('vendor') // kode app = boot
                else if (!seen.has(imp)) {
                  seen.add(imp)
                  stack.push(imp)
                }
              }
            }
            return roots
          }
          const LAZY = new Set(['vendor-pdf', 'vendor-excel', 'vendor-charts', 'vendor-cropper'])
          const roots = rootsReaching(id)
          if (roots.size === 1) {
            const only = [...roots][0]
            if (LAZY.has(only)) return only
          }
          // Dipakai jalur boot, atau dipakai >1 chunk lazy (mis. dep bersama) -> 'vendor'.
          return 'vendor'
        }
      }
    }
  }
})
