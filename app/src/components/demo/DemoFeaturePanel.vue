<script setup>
// ============================================================================
// WASEELA — Gate Demo: calon pelanggan PILIH demo dulu sebelum halaman login.
//   Dipakai HANYA di build demo (di-mount App.vue bila IS_DEMO). Reload-based.
//   Satu permukaan: modal SAMBUTAN terpusat (pitch + paket + toggle modul) yang
//   muncul sebagai GATE tiap pengunjung membuka situs (di rute /login) — TIDAK
//   langsung masuk form login. WAJIB pilih dulu: tidak ada tombol close / dismiss
//   backdrop — satu-satunya jalan lanjut = klik "Masuk ke aplikasi →". Tetap terbuka
//   melewati reload akibat toggle/preset dalam satu sesi.
//   (Tidak ada lagi tombol FAB / panel sudut — gate ini menggantikannya.)
// ============================================================================
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ALL_FEATURES, FEATURE_LABELS, PLAN_ORDER, PLAN_LABELS } from '@/config/plans.js'
import {
  currentFeatures,
  setFeature,
  applyPreset,
  resetDemo,
  welcomeState,
  setWelcomeOpen
} from '@/composables/useDemo'

const route = useRoute()
const welcome = ref(false)
const feats = currentFeatures()

const isLoginRoute = computed(() => route.path === '/login')

// Gate: muncul tiap pengunjung berada di /login, KECUALI sudah ditutup di sesi ini
// ('0'). Pakai watch (bukan onMounted) karena komponen di-mount di luar router-view,
// jadi rute sering belum '/login' saat mount — watch immediate menangkapnya andal,
// termasuk setelah reload akibat toggle/preset.
watch(
  isLoginRoute,
  (onLogin) => {
    if (onLogin) {
      if (welcomeState() === '0') return
      welcome.value = true
      setWelcomeOpen(true)
    } else {
      // keluar dari /login (mis. setelah login) → jangan biarkan gate menutupi app
      welcome.value = false
    }
  },
  { immediate: true }
)

// Modul anak (mengikuti parent — info untuk pelanggan; gating sebenarnya di isOn).
const CHILD_OF = { pos: 'keuangan', tabungan: 'keuangan', bisyaroh: 'keuangan', hutangPiutang: 'keuangan', fingerprint: 'absensi', absensiSekolah: 'absensi' }

function closeWelcome() {
  welcome.value = false
  setWelcomeOpen(false)
}

// Handler GATE — pertahankan MODAL terbuka melewati reload (toggle/preset me-reload),
// supaya pengunjung bisa terus bereksperimen sebelum masuk.
function onPresetWelcome(plan) {
  setWelcomeOpen(true)
  applyPreset(plan)
}
function onToggleWelcome(key) {
  setWelcomeOpen(true)
  setFeature(key, !feats[key])
}
function onResetWelcome() {
  setWelcomeOpen(true)
  resetDemo()
}

function isDisabled(key) {
  const parent = CHILD_OF[key]
  return parent ? !feats[parent] : false
}
</script>

<template>
  <!-- GATE demo pra-login (terpusat + backdrop) -->
  <transition name="demo-fade">
    <div
      v-if="welcome"
      class="demo-welcome-backdrop no-print"
      data-no-print
    >
      <div class="demo-welcome-card" role="dialog" aria-modal="true" aria-label="Demo Waseela">
        <div class="demo-welcome-badge">🎛️ MODE DEMO INTERAKTIF</div>
        <h2 class="demo-welcome-title">Selamat datang di Demo Waseela</h2>
        <p class="demo-welcome-pitch">
          Waseela adalah portal manajemen pesantren &amp; sekolah yang bisa di-<i>white-label</i>.
          Pilih paket atau nyalakan/matikan modul di bawah — tampilan aplikasi langsung
          menyesuaikan. Lalu masuk dengan <b>admin</b> / <b>demo1234</b> untuk menjelajah.
        </p>

        <!-- Preset paket (besar) -->
        <div class="demo-welcome-presets">
          <button
            v-for="p in PLAN_ORDER"
            :key="p"
            class="demo-welcome-preset"
            @click="onPresetWelcome(p)"
          >
            <span class="demo-welcome-preset-name">{{ PLAN_LABELS[p] }}</span>
            <span class="demo-welcome-preset-hint">Terapkan paket</span>
          </button>
        </div>

        <div class="demo-welcome-section-label">
          Modul aktif <span>(klik untuk ubah)</span>
        </div>

        <!-- Daftar modul (toggle) -->
        <div class="demo-list demo-welcome-list">
          <label
            v-for="key in ALL_FEATURES"
            :key="key"
            class="demo-row"
            :class="{ 'demo-row-disabled': isDisabled(key) }"
          >
            <input
              type="checkbox"
              :checked="!!feats[key]"
              :disabled="isDisabled(key)"
              @change="onToggleWelcome(key)"
            />
            <span class="demo-row-label">{{ FEATURE_LABELS[key] || key }}</span>
          </label>
        </div>

        <p class="demo-note">
          Mematikan <b>Keuangan</b> otomatis menyembunyikan POS, Tabungan, Bisyaroh &
          Hutang-Piutang. Perubahan diterapkan dengan memuat ulang halaman.
        </p>

        <div class="demo-welcome-actions">
          <button class="demo-reset demo-welcome-reset" @click="onResetWelcome">↺ Reset bawaan</button>
          <button class="demo-welcome-cta" @click="closeWelcome">Masuk ke aplikasi →</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.demo-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.demo-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
.demo-row:hover {
  background: #f8fafc;
}
.demo-row input {
  width: 16px;
  height: 16px;
  accent-color: var(--theme-color, #0f766e);
  cursor: pointer;
}
.demo-row-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.demo-row-label {
  line-height: 1.2;
}
.demo-note {
  font-size: 10.5px;
  color: #94a3b8;
  margin: 10px 2px 8px;
  line-height: 1.4;
}
.demo-reset {
  width: 100%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}
.demo-reset:hover {
  background: #f1f5f9;
}

/* ===== GATE sambutan pra-login ===== */
.demo-welcome-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.62);
  backdrop-filter: blur(2px);
}
.demo-welcome-card {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: 88vh;
  overflow-y: auto;
  background: #fff;
  color: #0f172a;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}
.demo-welcome-badge {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 4px 9px;
  border-radius: 9999px;
  margin-bottom: 10px;
}
.demo-welcome-title {
  font-size: 19px;
  font-weight: 800;
  margin: 0 0 6px;
  line-height: 1.2;
}
.demo-welcome-pitch {
  font-size: 12.5px;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 14px;
}
.demo-welcome-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.demo-welcome-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  padding: 10px 6px;
  cursor: pointer;
}
.demo-welcome-preset:hover {
  background: #d1fae5;
}
.demo-welcome-preset-name {
  font-weight: 800;
  font-size: 14px;
}
.demo-welcome-preset-hint {
  font-size: 10px;
  color: #059669;
  opacity: 0.85;
}
.demo-welcome-section-label {
  display: flex;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  margin: 4px 2px 6px;
}
.demo-welcome-section-label span {
  font-weight: 500;
  opacity: 0.8;
}
.demo-welcome-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}
.demo-welcome-reset {
  width: auto;
  flex: 0 0 auto;
  padding: 10px 12px;
}
.demo-welcome-cta {
  flex: 1;
  background: var(--theme-color, #047857);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 11px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}
.demo-welcome-cta:hover {
  filter: brightness(1.08);
}

.demo-fade-enter-active,
.demo-fade-leave-active {
  transition: opacity 0.2s ease;
}
.demo-fade-enter-from,
.demo-fade-leave-to {
  opacity: 0;
}
</style>
