#!/usr/bin/env node
// ============================================================================
// WASEELA — build-tenant: set config 1 lembaga lalu (opsional) build app.
//   Pakai:  node scripts/build-tenant.mjs <slug> [--no-build]
//   Contoh: node scripts/build-tenant.mjs mambaul-ulum
//           node scripts/build-tenant.mjs al-falah --no-build   (set config saja)
// ============================================================================
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const APP = resolve(ROOT, 'app')

const slug = process.argv[2]
const doBuild = !process.argv.includes('--no-build')
if (!slug) {
  console.error('Usage: node scripts/build-tenant.mjs <slug> [--no-build]')
  process.exit(1)
}

const tenantDir = resolve(ROOT, 'tenants', slug)
const tenantConfig = resolve(tenantDir, 'tenant.config.js')
if (!existsSync(tenantConfig)) {
  console.error(`[waseela] ✗ config tenant tidak ada: ${tenantConfig}`)
  console.error(`          Salin tenants/_template → tenants/${slug} lalu isi.`)
  process.exit(1)
}

// 1. Salin tenant.config → app/src/tenant.config.js (active, generated)
const raw = readFileSync(tenantConfig, 'utf8')
const header = `// GENERATED oleh scripts/build-tenant.mjs dari tenants/${slug}/tenant.config.js — JANGAN edit langsung.\n`
writeFileSync(resolve(APP, 'src/tenant.config.js'), header + raw)
console.log(`[waseela] ✓ tenant.config → app/src/tenant.config.js  (tenant: ${slug})`)

// 2. Muat config (ESM) utk patch native + ringkasan
const cfg = (await import(pathToFileURL(tenantConfig).href)).default

// 3. Patch capacitor.config.json (appId/appName — identitas native build)
const capPath = resolve(APP, 'capacitor.config.json')
const cap = JSON.parse(readFileSync(capPath, 'utf8'))
if (cfg.appId) cap.appId = cfg.appId
if (cfg.appName) cap.appName = cfg.appName
writeFileSync(capPath, JSON.stringify(cap, null, 2) + '\n')
console.log(`[waseela] ✓ capacitor.config: appId=${cfg.appId}  appName=${cfg.appName}`)

// 3b. Generate .firebaserc di ROOT (per-tenant, gitignored) dari firebaseConfig.projectId.
//     Dipakai `firebase deploy` agar otomatis menarget project lembaga aktif. Tiap tenant =
//     1 project = 1 site default → cukup projects.default (tanpa hosting target mapping).
const projectId = cfg.firebaseConfig?.projectId
if (projectId) {
  const rc = { projects: { default: projectId } }
  writeFileSync(resolve(ROOT, '.firebaserc'), JSON.stringify(rc, null, 2) + '\n')
  console.log(`[waseela] ✓ .firebaserc → project default = ${projectId}`)
} else {
  console.warn('[waseela] ⚠ firebaseConfig.projectId kosong — .firebaserc TIDAK digenerate (isi dulu sebelum deploy).')
}

// 4. Salin aset branding (logo) bila tersedia di folder tenant
const logo = resolve(tenantDir, 'logo.png')
if (existsSync(logo)) {
  copyFileSync(logo, resolve(APP, 'public/logo.png'))
  console.log('[waseela] ✓ logo.png → app/public/logo.png')
} else {
  console.log('[waseela] · logo.png tenant tak ada — pakai default app/public/logo.png')
}

// 5. Build (opsional)
if (doBuild) {
  console.log('[waseela] build app (vite)…')
  execSync('npm run build', { cwd: APP, stdio: 'inherit' })
  console.log(`[waseela] ✓ build selesai → app/dist  (tenant: ${slug})`)
} else {
  console.log('[waseela] --no-build: config sudah di-set. Uji: cd app && npm run dev')
}
