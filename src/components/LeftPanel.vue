<script setup>
import Chart from "primevue/chart";

defineProps({
  isPageBusy: Boolean,

  showPrimaryAggregationFilter: Boolean,
  showPrimaryMethodFilter: Boolean,
  showDynamicChartTypeFilter: Boolean,
  showStackBarFilter: Boolean,
  showCombineBarModeFilter: Boolean,

  primaryMeasure: {
    type: String,
    default: "",
  },
  primaryAggregation: {
    type: String,
    default: "",
  },
  primaryMethod: {
    type: String,
    default: "",
  },

  dynamicChartType: {
    type: String,
    default: "line",
  },
  combineBarMode: {
    type: String,
    default: "standard",
  },

  isPrimaryMonthlyDisabled: Boolean,
  isPrimaryQuarterlyDisabled: Boolean,
  isPrimaryYearlyDisabled: Boolean,

  filterOptions: {
    type: Object,
    required: true,
  },

  leftChartKey: {
    type: String,
    required: true,
  },
  chartDataL: {
    type: Object,
    required: true,
  },
  chartOptionsL: {
    type: Object,
    required: true,
  },
  valueLabelPlugin: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  "primary-measure-change",
  "primary-aggregation-change",
  "primary-method-change",
  "update:dynamic-chart-type",
  "update:combine-bar-mode",
]);

const onDynamicChartTypeChange = (event) => {
  emit("update:dynamic-chart-type", event.target.value);
};

const onCombineBarModeChange = (event) => {
  emit("update:combine-bar-mode", event.target.value);
};
</script>

<template>
  <div>
    <div class="theme-filter-panel mb-3 rounded-lg border p-3">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label class="theme-text-muted mb-1 block text-[12px]">Pilih Tampilan</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="primaryMeasure ?? ''"
            @change="emit('primary-measure-change', $event)"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih tampilan</option>
            <option
              v-for="opt in filterOptions.measure"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="showPrimaryAggregationFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Pilih Periode</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="primaryAggregation ?? ''"
            @change="emit('primary-aggregation-change', $event)"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih periode</option>
            <option value="monthly" :disabled="isPrimaryMonthlyDisabled">Bulanan</option>
            <option value="quarterly" :disabled="isPrimaryQuarterlyDisabled">Triwulanan</option>
            <option value="yearly" :disabled="isPrimaryYearlyDisabled">Tahunan</option>
          </select>
        </div>

        <div v-if="showPrimaryMethodFilter && primaryAggregation === 'monthly'">
          <label class="theme-text-muted mb-1 block text-[12px]">Metode Bulanan</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="primaryMethod ?? ''"
            @change="emit('primary-method-change', $event)"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih metode</option>
            <option
              v-for="opt in filterOptions.monthlyMethods"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="showPrimaryMethodFilter && primaryAggregation === 'quarterly'">
          <label class="theme-text-muted mb-1 block text-[12px]">Metode Triwulanan</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="primaryMethod ?? ''"
            @change="emit('primary-method-change', $event)"
            :disabled="isPageBusy"
          >
            <option value="" disabled>Pilih metode</option>
            <option
              v-for="opt in filterOptions.quarterlyMethods"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-show="showDynamicChartTypeFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Tipe Chart Dinamis</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="dynamicChartType"
            @change="onDynamicChartTypeChange"
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

        <div v-show="showStackBarFilter && showCombineBarModeFilter">
          <label class="theme-text-muted mb-1 block text-[12px]">Mode Bar Gabungan</label>
          <select
            class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
            :value="combineBarMode"
            @change="onCombineBarModeChange"
            :disabled="isPageBusy"
          >
            <option
              v-for="opt in filterOptions.combineBarModes"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <Chart
      :key="leftChartKey"
      :type="dynamicChartType"
      :data="chartDataL"
      :options="chartOptionsL"
      :plugins="[valueLabelPlugin]"
      class="chart-left-dynamic h-120"
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