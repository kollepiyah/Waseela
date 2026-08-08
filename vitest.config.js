import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  // Alias `@` = app/src, sama seperti app/vite.config.js. Tanpa ini modul app
  // yang memakai `@/...` tak bisa diimpor dari tests/.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app/src', import.meta.url)),
      // Vue terpasang di app/node_modules, bukan di root — tanpa alias ini berkas
      // tes di tests/ tak bisa `import { ref } from 'vue'` (modul app bisa karena
      // resolusinya relatif ke app/src). Runtime-only: tes tak mengompilasi template.
      vue: fileURLToPath(
        new URL('./app/node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url)
      ),
      // Sama ceritanya dengan `vue` di atas — pinia juga hanya ada di app/node_modules,
      // jadi tes yang menguji store (mis. settingsKeuanganMerge) tak bisa mengimpornya.
      pinia: fileURLToPath(new URL('./app/node_modules/pinia/dist/pinia.mjs', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js']
  }
})
