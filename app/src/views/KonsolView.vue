<script setup>
// Konsol PLATFORM OWNER (vendor Bakafrawi) — kelola SEMUA tenant + pembelian.
// Full-screen, di luar AppShell tenant. Gate: router meta roleSistem 'platform_owner'.
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useKonsol } from '@/composables/useKonsol'

const router = useRouter()
const auth = useAuthStore()
const k = useKonsol()

const tab = ref('dashboard')
const rows = ref([])          // platform_stats
const tenants = ref([])
const langganan = ref([])
const notice = ref('')
const noticeErr = ref(false)

const PLANS = ['basic', 'pro', 'premium']
const STATUS = ['pending', 'paid', 'active', 'expired', 'dibatalkan']
const PERIODE = ['bulanan', 'tahunan', 'sekali']

function flash(msg, isErr = false) {
  notice.value = msg; noticeErr.value = isErr
  setTimeout(() => { if (notice.value === msg) notice.value = '' }, 4000)
}

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

// ---- loaders ----
async function loadDashboard() {
  try { rows.value = await k.stats() } catch (e) { flash(e.message, true) }
}
async function loadTenants() {
  try { tenants.value = await k.listTenants() } catch (e) { flash(e.message, true) }
}
async function loadLangganan() {
  try { langganan.value = await k.listLangganan() } catch (e) { flash(e.message, true) }
}

const summary = computed(() => {
  const total = rows.value.length
  const aktif = rows.value.filter((r) => r.aktif).length
  const langgananAktif = rows.value.filter((r) => r.langganan_status === 'active' || r.langganan_status === 'paid').length
  const now = new Date()
  const soon = rows.value.filter((r) => {
    if (!r.berakhir) return false
    const d = new Date(r.berakhir)
    const days = (d - now) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }).length
  const totalSantri = rows.value.reduce((s, r) => s + Number(r.santri_count || 0), 0)
  return { total, aktif, langgananAktif, soon, totalSantri }
})

// ---- tenant form ----
const newTenant = ref({ slug: '', nama: '', plan: 'basic' })
async function submitTenant() {
  if (!newTenant.value.slug || !newTenant.value.nama) return flash('Slug & nama wajib diisi', true)
  try {
    await k.createTenant({ ...newTenant.value })
    flash('Tenant dibuat: ' + newTenant.value.slug)
    newTenant.value = { slug: '', nama: '', plan: 'basic' }
    await Promise.all([loadTenants(), loadDashboard()])
  } catch (e) { flash(e.message, true) }
}
async function toggleAktif(t) {
  try { await k.updateTenant(t.id, { aktif: !t.aktif }); await Promise.all([loadTenants(), loadDashboard()]) }
  catch (e) { flash(e.message, true) }
}
async function setPlan(t, plan) {
  try { await k.updateTenant(t.id, { plan }); await Promise.all([loadTenants(), loadDashboard()]) }
  catch (e) { flash(e.message, true) }
}
async function provision(t) {
  if (!confirm('Buat akun admin awal untuk "' + t.nama + '" (admin@' + t.slug + '.waseela.local)?')) return
  try {
    const res = await k.provisionAdmin(t.slug)
    flash('Admin dibuat untuk ' + t.slug + (res?.password ? ' — sandi: ' + res.password : ''))
  } catch (e) { flash('Provision gagal: ' + e.message, true) }
}

// ---- langganan form ----
const newLang = ref({ tenant_id: '', plan: 'basic', harga: 0, status: 'pending', periode: 'tahunan', mulai: '', berakhir: '', metode_bayar: '' })
async function submitLangganan() {
  if (!newLang.value.tenant_id) return flash('Pilih tenant', true)
  try {
    const row = { ...newLang.value }
    if (!row.mulai) delete row.mulai
    if (!row.berakhir) delete row.berakhir
    await k.createLangganan(row)
    flash('Pembelian dicatat')
    newLang.value = { tenant_id: '', plan: 'basic', harga: 0, status: 'pending', periode: 'tahunan', mulai: '', berakhir: '', metode_bayar: '' }
    await Promise.all([loadLangganan(), loadDashboard()])
  } catch (e) { flash(e.message, true) }
}
async function setLangStatus(l, status) {
  try { await k.updateLangganan(l.id, { status }); await Promise.all([loadLangganan(), loadDashboard()]) }
  catch (e) { flash(e.message, true) }
}

async function keluar() {
  try { await auth.logout() } finally { router.replace({ name: 'login' }) }
}

onMounted(async () => {
  await Promise.all([loadDashboard(), loadTenants(), loadLangganan()])
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-emerald-800 text-white shadow">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-white/15 grid place-items-center font-bold">W</div>
        <div class="flex-1">
          <div class="font-semibold leading-tight">Konsol Platform</div>
          <div class="text-[11px] text-emerald-200">Waseela · kelola tenant & pembelian</div>
        </div>
        <span class="text-sm text-emerald-100 hidden sm:block">{{ auth.sesiAktif?.nama || 'Owner' }}</span>
        <button class="text-sm bg-white/15 hover:bg-white/25 rounded px-3 py-1.5" @click="keluar">Keluar</button>
      </div>
      <nav class="max-w-6xl mx-auto px-4 flex gap-1">
        <button v-for="t in [['dashboard','Dashboard'],['tenant','Tenant'],['langganan','Pembelian']]" :key="t[0]"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
          :class="tab === t[0] ? 'border-white text-white' : 'border-transparent text-emerald-200 hover:text-white'"
          @click="tab = t[0]">{{ t[1] }}</button>
      </nav>
    </header>

    <!-- Notice -->
    <div v-if="notice" class="max-w-6xl mx-auto px-4 pt-3">
      <div class="rounded px-3 py-2 text-sm" :class="noticeErr ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'">{{ notice }}</div>
    </div>

    <main class="max-w-6xl mx-auto px-4 py-5">
      <!-- ===== DASHBOARD ===== -->
      <section v-show="tab === 'dashboard'">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div class="text-2xl font-bold">{{ summary.total }}</div><div class="text-xs text-slate-500">Total tenant</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div class="text-2xl font-bold text-emerald-600">{{ summary.aktif }}</div><div class="text-xs text-slate-500">Tenant aktif</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div class="text-2xl font-bold text-emerald-600">{{ summary.langgananAktif }}</div><div class="text-xs text-slate-500">Langganan aktif</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div class="text-2xl font-bold text-amber-500">{{ summary.soon }}</div><div class="text-xs text-slate-500">Kadaluarsa ≤30 hari</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm">
            <div class="text-2xl font-bold">{{ summary.totalSantri }}</div><div class="text-xs text-slate-500">Total santri</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <tr><th class="p-3">Lembaga</th><th class="p-3">Paket</th><th class="p-3">Status</th><th class="p-3">Berakhir</th><th class="p-3 text-right">Santri</th><th class="p-3 text-right">Guru</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.tenant_id" class="border-b border-slate-50 dark:border-slate-700/50">
                <td class="p-3"><div class="font-medium">{{ r.nama }}</div><div class="text-xs text-slate-400">{{ r.slug }}</div></td>
                <td class="p-3 uppercase text-xs">{{ r.plan }}</td>
                <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full" :class="r.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'">{{ r.aktif ? 'aktif' : 'nonaktif' }}</span> <span v-if="r.langganan_status" class="text-xs text-slate-400">/ {{ r.langganan_status }}</span></td>
                <td class="p-3 text-xs">{{ r.berakhir || '—' }}</td>
                <td class="p-3 text-right">{{ r.santri_count }}</td>
                <td class="p-3 text-right">{{ r.guru_count }}</td>
              </tr>
              <tr v-if="!rows.length"><td colspan="6" class="p-6 text-center text-slate-400">Belum ada tenant. Tambah di tab "Tenant".</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===== TENANT ===== -->
      <section v-show="tab === 'tenant'">
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-4">
          <div class="font-medium mb-3 text-sm">Tambah lembaga (tenant)</div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input v-model="newTenant.slug" placeholder="slug (mis. al-hikmah)" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600" />
            <input v-model="newTenant.nama" placeholder="Nama lembaga" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600" />
            <select v-model="newTenant.plan" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600">
              <option v-for="p in PLANS" :key="p" :value="p">{{ p }}</option>
            </select>
            <button class="bg-emerald-700 hover:bg-emerald-800 text-white rounded px-4 py-2 text-sm" @click="submitTenant">Tambah</button>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <tr><th class="p-3">Lembaga</th><th class="p-3">Paket</th><th class="p-3">Status</th><th class="p-3 text-right">Aksi</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in tenants" :key="t.id" class="border-b border-slate-50 dark:border-slate-700/50">
                <td class="p-3"><div class="font-medium">{{ t.nama }}</div><div class="text-xs text-slate-400">{{ t.slug }}</div></td>
                <td class="p-3">
                  <select :value="t.plan" @change="setPlan(t, $event.target.value)" class="border rounded px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-600">
                    <option v-for="p in PLANS" :key="p" :value="p">{{ p }}</option>
                  </select>
                </td>
                <td class="p-3">
                  <button class="text-xs px-2 py-0.5 rounded-full" :class="t.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'" @click="toggleAktif(t)">{{ t.aktif ? 'aktif' : 'nonaktif' }}</button>
                </td>
                <td class="p-3 text-right">
                  <button class="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded px-2 py-1" @click="provision(t)">Provision admin</button>
                </td>
              </tr>
              <tr v-if="!tenants.length"><td colspan="4" class="p-6 text-center text-slate-400">Belum ada tenant.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===== PEMBELIAN ===== -->
      <section v-show="tab === 'langganan'">
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-4">
          <div class="font-medium mb-3 text-sm">Catat pembelian / langganan</div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select v-model="newLang.tenant_id" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600">
              <option value="">— pilih tenant —</option>
              <option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.nama }} ({{ t.slug }})</option>
            </select>
            <select v-model="newLang.plan" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600">
              <option v-for="p in PLANS" :key="p" :value="p">{{ p }}</option>
            </select>
            <input v-model.number="newLang.harga" type="number" placeholder="Harga (Rp)" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600" />
            <select v-model="newLang.periode" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600">
              <option v-for="p in PERIODE" :key="p" :value="p">{{ p }}</option>
            </select>
            <select v-model="newLang.status" class="border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600">
              <option v-for="s in STATUS" :key="s" :value="s">{{ s }}</option>
            </select>
            <label class="text-xs text-slate-500 flex flex-col">Mulai<input v-model="newLang.mulai" type="date" class="border rounded px-2 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-600" /></label>
            <label class="text-xs text-slate-500 flex flex-col">Berakhir<input v-model="newLang.berakhir" type="date" class="border rounded px-2 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-600" /></label>
            <button class="bg-emerald-700 hover:bg-emerald-800 text-white rounded px-4 py-2 text-sm self-end" @click="submitLangganan">Catat</button>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <tr><th class="p-3">Tenant</th><th class="p-3">Paket</th><th class="p-3 text-right">Harga</th><th class="p-3">Periode</th><th class="p-3">Berakhir</th><th class="p-3">Status</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in langganan" :key="l.id" class="border-b border-slate-50 dark:border-slate-700/50">
                <td class="p-3"><div class="font-medium">{{ l.tenants?.nama || '—' }}</div><div class="text-xs text-slate-400">{{ l.tenants?.slug }}</div></td>
                <td class="p-3 uppercase text-xs">{{ l.plan }}</td>
                <td class="p-3 text-right">{{ rupiah(l.harga) }}</td>
                <td class="p-3 text-xs">{{ l.periode || '—' }}</td>
                <td class="p-3 text-xs">{{ l.berakhir || '—' }}</td>
                <td class="p-3">
                  <select :value="l.status" @change="setLangStatus(l, $event.target.value)" class="border rounded px-2 py-1 text-xs dark:bg-slate-900 dark:border-slate-600">
                    <option v-for="s in STATUS" :key="s" :value="s">{{ s }}</option>
                  </select>
                </td>
              </tr>
              <tr v-if="!langganan.length"><td colspan="6" class="p-6 text-center text-slate-400">Belum ada pembelian.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
