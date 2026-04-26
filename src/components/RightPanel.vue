<script setup>
import Chart from "primevue/chart";

defineProps({
  isPageBusy: Boolean,

  showStaticPeriodFilter: Boolean,
  showStaticMethodFilter: Boolean,
  showStaticChartTypeFilter: Boolean,
  showStaticDisplayUnitFilter: Boolean,

  staticComponent: {
    type: String,
    default: "",
  },
  activeMappedSource: {
    type: String,
    default: "",
  },

  staticMeasure: {
    type: String,
    default: "nilai",
  },
  staticPeriod: {
    type: String,
    default: "",
  },
  staticMethod: {
    type: String,
    default: "",
  },
  staticChartType: {
    type: String,
    default: "line",
  },
  staticDisplayUnit: {
    type: String,
    default: "",
  },
  staticDisplayUnitOptions: {
    type: Array,
    default: () => [],
  },

  isStaticQuarterlyDisabled: Boolean,
  isStaticYearlyDisabled: Boolean,

  filterOptions: {
    type: Object,
    required: true,
  },

  rightChartKey: {
    type: String,
    required: true,
  },
  chartDataR: {
    type: Object,
    required: true,
  },
  chartOptionsR: {
    type: Object,
    required: true,
  },
  valueLabelPlugin: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  "update:static-measure",
  "update:static-period",
  "update:static-method",
  "update:static-chart-type",
  "update:static-display-unit",
]);

const onStaticMeasureChange = (event) => {
  emit("update:static-measure", event.target.value);
};

const onStaticPeriodChange = (event) => {
  emit("update:static-period", event.target.value);
};

const onStaticMethodChange = (event) => {
  emit("update:static-method", event.target.value);
};

const onStaticChartTypeChange = (event) => {
  emit("update:static-chart-type", event.target.value);
};

const onStaticDisplayUnitChange = (event) => {
  emit("update:static-display-unit", event.target.value);
};
</script>

<template>
  <div>
    <div class="theme-filter-panel mb-3 rounded-lg border p-3">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div v-if="showStaticPeriodFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Pilih Tampilan</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="staticMeasure"
            @change="onStaticMeasureChange"
            :disabled="isPageBusy"
          >
            <option
              v-for="opt in filterOptions.measure"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="showStaticPeriodFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Pilih Periode</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="staticPeriod"
            @change="onStaticPeriodChange"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih periode</option>
            <option
              v-for="opt in filterOptions.staticPeriod"
              :key="opt.value"
              :value="opt.value"
              :disabled="opt.value === 'quarterly' ? isStaticQuarterlyDisabled : isStaticYearlyDisabled"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="showStaticMethodFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Metode</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="staticMethod"
            @change="onStaticMethodChange"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih metode</option>
            <option
              v-for="opt in filterOptions.staticQuarterlyMethods"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="showStaticDisplayUnitFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Satuan Rupiah</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="staticDisplayUnit"
            @change="onStaticDisplayUnitChange"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih satuan</option>
            <option
              v-for="opt in staticDisplayUnitOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-show="showStaticChartTypeFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Tipe Chart Statistik</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="staticChartType"
            @change="onStaticChartTypeChange"
            :disabled="isPageBusy"
          >
            <option
              v-for="opt in filterOptions.chartTypes"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <p
        v-if="staticComponent && !activeMappedSource"
        class="mt-3 text-[12px] text-amber-400"
      >
        Komponen ini belum memiliki data indikator untuk chart dinamis, jadi panel kiri dikosongkan sementara. Chart statis tetap menggunakan data PDB.
      </p>
    </div>

    <Chart
      :key="rightChartKey"
      :type="staticChartType"
      :data="chartDataR"
      :options="chartOptionsR"
      :plugins="[valueLabelPlugin]"
      class="h-120"
    />
  </div>
</template>

<style scoped>
.theme-text-muted {
  color: var(--p-text-muted-color);
}

.theme-filter-panel {
  border-color: var(--p-content-border-color);
  background: var(--p-content-background);
}

.theme-select {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  outline: none;
}

.theme-select:focus {
  border-color: var(--p-primary-500);
  box-shadow: 0 0 0 1px var(--p-primary-500);
}
</style>