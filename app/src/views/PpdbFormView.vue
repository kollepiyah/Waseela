<template>
  <div class="p-4 md:p-6 min-h-screen max-w-3xl mx-auto">
    <div class="bg-[var(--bg-card)] rounded-2xl p-6 border-t-8 border-teal-600 shadow-md text-center">
      <i class="fas fa-info-circle text-teal-500 text-4xl mb-3"></i>
      <h2 class="text-lg font-black text-[var(--text-primary)] mb-2">Formulir PSB Public</h2>
      <p class="text-sm text-[var(--text-secondary)] mb-4">Formulir pendaftaran santri baru sekarang ada di sub-aplikasi terpisah:</p>
      <a v-if="psbUrl" :href="psbUrl" target="_blank" class="inline-block px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-black rounded-xl text-sm shadow"><i class="fas fa-external-link-alt mr-1"></i>Buka Form PSB</a>
      <p v-else class="text-sm text-amber-600 dark:text-amber-400 font-semibold">Alamat formulir PSB belum diatur. Isi di Pengaturan → PSB.</p>
      <p class="text-[11px] text-[var(--text-secondary)] mt-4">Atau scan QR yang dibagikan admin.</p>
    </div>
  </div>
</template>
<script setup>
// v.21.32 — PSB public form di sub-app terpisah. Route /psb-form di sini = landing page.
// White-label: alamatnya per-lembaga (Pengaturan → psbPublicUrl); kosong = tautan disembunyikan.
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { BRAND } from '@/config/brand'

const settingsStore = useSettingsStore()
const psbUrl = computed(() => settingsStore.settings?.psbPublicUrl || BRAND.psbUrl)
</script>
