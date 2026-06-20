<script setup>
// ============================================================================
// WASEELA — Panel Demo: calon pelanggan nyala/matikan modul & lihat app berubah.
//   Dipakai HANYA di build demo (di-mount App.vue bila IS_DEMO). Reload-based.
// ============================================================================
import { ref } from 'vue'
import { ALL_FEATURES, FEATURE_LABELS, PLAN_ORDER, PLAN_LABELS } from '@/config/plans.js'
import {
  currentFeatures,
  setFeature,
  applyPreset,
  resetDemo,
  isPanelOpen,
  setPanelOpen
} from '@/composables/useDemo'

const open = ref(isPanelOpen())
const feats = currentFeatures()

// Modul anak (mengikuti parent — info untuk pelanggan; gating sebenarnya di isOn).
const CHILD_OF = { pos: 'keuangan', tabungan: 'keuangan', bisyaroh: 'keuangan', hutangPiutang: 'keuangan', fingerprint: 'absensi' }

function toggle() {
  open.value = !open.value
  setPanelOpen(open.value)
}
function onToggleFeature(key) {
  setFeature(key, !feats[key]) // setFeature me-reload
}
function onPreset(plan) {
  setPanelOpen(true)
  applyPreset(plan)
}
function onReset() {
  setPanelOpen(true)
  resetDemo()
}
function isDisabled(key) {
  const parent = CHILD_OF[key]
  return parent ? !feats[parent] : false
}
</script>

<template>
  <div class="demo-panel no-print" data-no-print>
    <!-- Tombol melayang -->
    <button v-if="!open" class="demo-fab" @click="toggle" title="Mode Demo — pilih fitur">
      <span>🎛️</span> Mode Demo
    </button>

    <!-- Panel -->
    <div v-else class="demo-card">
      <div class="demo-head">
        <div>
          <div class="demo-title">🎛️ Mode Demo</div>
          <div class="demo-sub">Nyalakan/matikan modul — tampilan menyesuaikan</div>
        </div>
        <button class="demo-x" @click="toggle" title="Tutup">✕</button>
      </div>

      <!-- Preset paket -->
      <div class="demo-presets">
        <span class="demo-presets-label">Paket cepat:</span>
        <button v-for="p in PLAN_ORDER" :key="p" class="demo-preset-btn" @click="onPreset(p)">
          {{ PLAN_LABELS[p] }}
        </button>
      </div>

      <!-- Daftar modul -->
      <div class="demo-list">
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
            @change="onToggleFeature(key)"
          />
          <span class="demo-row-label">{{ FEATURE_LABELS[key] || key }}</span>
        </label>
      </div>

      <p class="demo-note">
        Mematikan <b>Keuangan</b> otomatis menyembunyikan POS, Tabungan, Bisyaroh & Hutang-Piutang.
      </p>

      <button class="demo-reset" @click="onReset">↺ Reset ke bawaan</button>
    </div>
  </div>
</template>

<style scoped>
.demo-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 99999;
  font-family: inherit;
}
.demo-fab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--theme-color, #0f766e);
  color: #fff;
  border: none;
  padding: 10px 14px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.demo-fab:hover {
  filter: brightness(1.08);
}
.demo-card {
  width: 290px;
  max-height: 78vh;
  overflow-y: auto;
  background: #fff;
  color: #0f172a;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid #e2e8f0;
  padding: 14px;
}
.demo-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.demo-title {
  font-weight: 800;
  font-size: 15px;
}
.demo-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.demo-x {
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
}
.demo-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e2e8f0;
}
.demo-presets-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}
.demo-preset-btn {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.demo-preset-btn:hover {
  background: #d1fae5;
}
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
</style>
