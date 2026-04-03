<script setup>
import { computed } from "vue";
import { useChartStore } from "../stores/useChartStore";
import LineChartComponent from "./LineChartComponent.vue";

const props = defineProps({
  datasets: Object,
  isGabung: {
    type: Boolean,
    default: false,
  },
  monthlyDisabled: {
    type: Boolean,
    default: false,
  },
  quarterlyDisabled: {
    type: Boolean,
    default: false,
  },
});

const chartStore = useChartStore();

const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtm" },
    { label: "Y on Y", value: "yoy" },
    { label: "Y to D", value: "ytd" },
  ],
  quarterlyMethods: [
    { label: "Q to Q", value: "qtq" },
    { label: "Y on Y", value: "yoy" },
    { label: "C to C", value: "ctc" },
  ],
};

const config = computed(() => chartStore.getCompareConfig(props.datasets));

const parsePeriod = (period) => {
  const text = String(period ?? "").trim().toUpperCase();

  let m = text.match(/^(\d{4})M(\d{1,2})$/);
  if (m) {
    return {
      type: "monthly",
      year: Number(m[1]),
      month: Number(m[2]),
    };
  }

  m = text.match(/^(\d{4})Q([1-4])$/);
  if (m) {
    return {
      type: "quarterly",
      year: Number(m[1]),
      quarter: Number(m[2]),
      month: Number(m[2]) * 3,
    };
  }

  return { type: "unknown" };
};

const isQuarterEndPeriod = (period) => {
  const p = parsePeriod(period);
  return p.type === "monthly" && [3, 6, 9, 12].includes(p.month);
};

const monthlyToQuarterlyByPeriods = (monthly = [], periods = []) => {
  const out = [];
  periods.forEach((period, index) => {
    if (isQuarterEndPeriod(period)) {
      out.push(monthly[index] ?? null);
    }
  });
  return out;
};

const getBaseSeries = (dataset, aggregation) => {
  if (aggregation === "monthly") {
    return dataset.series.monthly ?? [];
  }

  if (dataset.rawFrequency === "quarterly") return dataset.series.quarterly ?? [];

  return monthlyToQuarterlyByPeriods(dataset.series.monthly ?? [], dataset.periods ?? []);
};

const getGrowthSeries = (dataset, aggregation, method) => {
  const payload = dataset?.growth?.[aggregation]?.[method];

  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;

  return [];
};

const preparedSeries = computed(() => {
  const measure = config.value?.measure ?? "nilai";
  const fallbackAggregation =
    props.datasets.rawFrequency === "quarterly" ? "quarterly" : "monthly";
  const aggregation = config.value?.aggregation ?? fallbackAggregation;
  const method = config.value?.method ?? (aggregation === "monthly" ? "mtm" : "qtq");

  if (measure === "nilai") return getBaseSeries(props.datasets, aggregation);
  return getGrowthSeries(props.datasets, aggregation, method);
});

const getLastNonNull = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
};

const getPrevNonNull = (arr) => {
  let found = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) {
      found++;
      if (found === 2) return arr[i];
    }
  }
  return null;
};

const last = computed(() => getLastNonNull(preparedSeries.value));
const prev = computed(() => getPrevNonNull(preparedSeries.value));

const isUp = computed(() => (Number(last.value ?? 0) - Number(prev.value ?? 0)) >= 0);

const displayValue = computed(() => {
  if (last.value === null || last.value === undefined) return "-";
  return Number(last.value).toFixed(2);
});

const growthText = computed(() => {
  const l = Number(last.value ?? 0);
  const p = Number(prev.value ?? 0);
  if (!p) return "0.00%";
  const v = ((l - p) / p) * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
});

const isSelected = computed(() => chartStore.isSelected(props.datasets.id));
const isPrimary = computed(() => chartStore.primaryId === props.datasets.id);
const isDisabled = computed(() => chartStore.isLocked && !isSelected.value);
const isExpanded = computed(() => chartStore.isExpanded(props.datasets.id));

const canChooseMonthly = computed(() => props.datasets.rawFrequency === "monthly");

const isCardMonthlyDisabled = computed(() => {
  if (!canChooseMonthly.value) return true;
  if (!props.isGabung) return false;
  return props.monthlyDisabled;
});

const isCardQuarterlyDisabled = computed(() => {
  if (!props.isGabung) return false;
  return props.quarterlyDisabled;
});

const showAggregationFilter = computed(() => !!config.value.measure);
const showMethodFilter = computed(
  () => config.value.measure === "pertumbuhan" && !!config.value.aggregation
);

const onClickCard = () => {
  if (isDisabled.value) return;

  if (chartStore.selectedDataset.length > 1) {
    const confirmChange = window.confirm("Apakah ingin melihat chart ini saja?");
    if (!confirmChange) return;
  }

  chartStore.setPrimary(props.datasets);
};

const onToggleCompare = () => {
  if (isDisabled.value) return;
  chartStore.toggleCompare(props.datasets);
};

const onMeasureChange = (e) => {
  const measure = e.target.value;
  chartStore.setMeasure(props.datasets.id, measure, props.datasets);

  if (measure === "pertumbuhan") {
    const defaultAggregation =
      props.datasets.rawFrequency === "quarterly" ? "quarterly" : "monthly";
    const defaultMethod = defaultAggregation === "monthly" ? "mtm" : "qtq";

    chartStore.setAggregation(props.datasets.id, defaultAggregation, props.datasets);
    chartStore.setMethod(props.datasets.id, defaultMethod, props.datasets);
  }
};

const onAggregationChange = (e) => {
  chartStore.setAggregation(props.datasets.id, e.target.value, props.datasets);
};

const onMethodChange = (e) => {
  chartStore.setMethod(props.datasets.id, e.target.value, props.datasets);
};
</script>

<template>
  <div
    class="w-full py-2 pl-3 pr-2 cursor-pointer select-none rounded-r-xl transition-all duration-200"
    :class="[
      isPrimary ? 'border-l-[3px] border-blue-500' : 'border-l-[3px] border-transparent',
      isSelected ? 'card-selected' : 'card-hover',
      isDisabled ? 'opacity-40 cursor-not-allowed' : ''
    ]"
    @click="onClickCard"
  >
    <div
      class="grid items-center min-w-0"
      style="grid-template-columns: minmax(0,1fr) 56px 60px 26px; column-gap:4px;"
    >
      <div class="min-w-0">
        <h1 class="truncate text-[14px] font-semibold theme-text" :title="datasets.indicatorName">
          {{ datasets.indicatorName }}
        </h1>

        <p class="truncate text-[14px] font-semibold theme-text mt-[2px]">
          {{ datasets.groupCode }}
        </p>
      </div>

      <div class="w-[56px]">
        <div class="h-11 w-full">
          <LineChartComponent :datasets="datasets" class="w-full h-full" />
        </div>
      </div>

      <div class="w-[60px] text-right">
        <h1 class="text-[14px] font-semibold leading-tight theme-text">
          {{ displayValue }}
        </h1>

        <p class="text-[14px] font-semibold leading-tight" :class="isUp ? 'text-green-500' : 'text-red-500'">
          {{ growthText }}
        </p>
      </div>

      <button class="w-[26px] h-[26px] grid place-items-center" @click.stop="onToggleCompare" type="button">
        <i
          class="text-[18px] theme-text transition-colors duration-200"
          :class="isSelected
            ? 'pi pi-minus-circle text-blue-400 hover:text-red-500'
            : 'pi pi-plus-circle hover:text-blue-500'"
        />
      </button>
    </div>

    <div
      v-if="isSelected && isExpanded && !isPrimary"
      class="mt-3 rounded-lg p-3 theme-filter-panel"
      @click.stop
    >
      <div>
        <label class="block text-[12px] mb-1 theme-text-muted">Pilih Tampilan</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.measure ?? ''"
          @change="onMeasureChange"
        >
          <option value="" disabled>Pilih tampilan</option>
          <option v-for="opt in FILTER_OPTIONS.measure" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="showAggregationFilter" class="mt-3">
        <label class="block text-[12px] mb-1 theme-text-muted">Pilih Frekuensi</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.aggregation ?? ''"
          @change="onAggregationChange"
        >
          <option value="" disabled>Pilih frekuensi</option>
          <option value="monthly" :disabled="isCardMonthlyDisabled">Bulanan</option>
          <option value="quarterly" :disabled="isCardQuarterlyDisabled">Triwulanan</option>
        </select>

        <p v-if="!canChooseMonthly" class="text-[11px] mt-1 theme-text-muted">
          Data triwulanan hanya bisa memilih filter triwulanan.
        </p>
      </div>

      <div v-if="showMethodFilter && config.aggregation === 'monthly'" class="mt-3">
        <label class="block text-[12px] mb-1 theme-text-muted">Metode Bulanan</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.method ?? ''"
          @change="onMethodChange"
        >
          <option value="" disabled>Pilih metode</option>
          <option v-for="opt in FILTER_OPTIONS.monthlyMethods" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="showMethodFilter && config.aggregation === 'quarterly'" class="mt-3">
        <label class="block text-[12px] mb-1 theme-text-muted">Metode Triwulanan</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.method ?? ''"
          @change="onMethodChange"
        >
          <option value="" disabled>Pilih metode</option>
          <option v-for="opt in FILTER_OPTIONS.quarterlyMethods" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-text {
  color: var(--p-text-color);
}

.theme-text-muted {
  color: var(--p-text-muted-color);
}

.theme-filter-panel {
  border: 1px solid var(--p-content-border-color);
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

.theme-select option {
  color: var(--p-text-color);
  background: var(--p-content-background);
}

.card-hover:hover {
  background: color-mix(in srgb, var(--p-primary-500) 10%, transparent);
}

.card-selected {
  background: color-mix(in srgb, var(--p-primary-500) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--p-primary-500) 45%, transparent);
}
</style>