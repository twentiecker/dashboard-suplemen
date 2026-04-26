<script setup>
import { computed } from "vue";
import { useChartStore } from "../stores/useChartStore";
import LineChartComponent from "./LineChartComponent.vue";
import {
  normalizeTextKey,
  normalizeUnitLabel,
  getAvailableDisplayUnits,
  convertSeriesMetaByUnit,
  formatChartNumber,
} from "../utils/chartHelpers";

const props = defineProps({
  datasets: Object,
  isGabung: { type: Boolean, default: false },
  monthlyDisabled: { type: Boolean, default: false },
  quarterlyDisabled: { type: Boolean, default: false },
});

const chartStore = useChartStore();

const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  period: [
    { label: "Bulanan", value: "monthly" },
    { label: "Triwulanan", value: "quarterly" },
    { label: "Tahunan", value: "yearly" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtom" },
    { label: "Y on Y", value: "yony" },
    { label: "Y to D", value: "ytod" },
  ],
  quarterlyMethods: [
    { label: "Q to Q", value: "qtoq" },
    { label: "Y on Y", value: "yony" },
    { label: "C to C", value: "ctoc" },
  ],
};

const config = computed(() => chartStore.getCompareConfig(props.datasets));

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const hasValidArrayData = (arr = []) =>
  Array.isArray(arr) && arr.some((value) => isFiniteNumber(value));

const hasValidSeriesData = (seriesLike) => {
  const data = Array.isArray(seriesLike?.data) ? seriesLike.data : [];
  return data.some((value) => isFiniteNumber(value));
};

function getDatasetUnitLabel(dataset, measure = "nilai") {
  if (measure === "pertumbuhan") return "%";

  const codeCandidates = [
    dataset?.apiCode,
    dataset?.kode,
    dataset?.code,
    dataset?.sourceCode,
    dataset?.meta?.kode,
    dataset?.meta?.code,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  const nameCandidates = [
    dataset?.indicatorName,
    dataset?.deskripsi,
    dataset?.label,
    dataset?.name,
    dataset?.meta?.deskripsi,
    dataset?.meta?.label,
  ]
    .map((v) => normalizeTextKey(v))
    .filter(Boolean);

  let rawUnit =
    dataset?.valueUnitLabel ??
    dataset?.satuan ??
    dataset?.unit ??
    dataset?.satuanLabel ??
    dataset?.meta?.satuan ??
    dataset?.meta?.unit ??
    "";

  if (!rawUnit) {
    // tidak ada lookup map di card, jadi fallback dari dataset saja
  }

  return normalizeUnitLabel(rawUnit, "Nilai");
}

const baseUnitLabel = computed(() =>
  getDatasetUnitLabel(props.datasets, config.value?.measure ?? "nilai")
);

const displayUnitOptions = computed(() => {
  const available = getAvailableDisplayUnits(baseUnitLabel.value);
  return available.map((unit) => ({
    value: unit,
    label: unit,
  }));
});

const effectiveDisplayUnit = computed(() => {
  const baseUnit = baseUnitLabel.value;
  const available = getAvailableDisplayUnits(baseUnit);
  const savedUnit = config.value?.displayUnit ?? null;

  if ((config.value?.measure ?? "nilai") !== "nilai") return baseUnit;
  if (!available.length) return baseUnit;
  if (savedUnit && available.includes(savedUnit)) return savedUnit;

  return baseUnit;
});

const showDisplayUnitFilter = computed(() => {
  return (
    (config.value?.measure ?? "nilai") === "nilai" &&
    displayUnitOptions.value.length > 1
  );
});

const allowMonthlyByMeta = computed(() => {
  const value = props.datasets?.aggregationAvailability?.allowMonthly;
  return typeof value === "boolean" ? value : true;
});

const allowQuarterlyByMeta = computed(() => {
  const value = props.datasets?.aggregationAvailability?.allowQuarterly;
  return typeof value === "boolean" ? value : true;
});

const allowYearlyByMeta = computed(() => {
  const value = props.datasets?.aggregationAvailability?.allowYearly;
  return typeof value === "boolean" ? value : true;
});

const datasetHasAggregationData = (dataset, aggregation, measure = "nilai") => {
  if (!dataset) return false;

  if (aggregation === "monthly" && dataset?.aggregationAvailability?.allowMonthly === false) {
    return false;
  }

  if (aggregation === "quarterly" && dataset?.aggregationAvailability?.allowQuarterly === false) {
    return false;
  }

  if (aggregation === "yearly" && dataset?.aggregationAvailability?.allowYearly === false) {
    return false;
  }

  if (measure === "nilai") {
    if (aggregation === "monthly") return hasValidArrayData(dataset?.series?.monthly);
    if (aggregation === "quarterly") return hasValidArrayData(dataset?.series?.quarterly);
    if (aggregation === "yearly") return hasValidArrayData(dataset?.series?.yearly);
    return false;
  }

  if (aggregation === "monthly") {
    return (
      hasValidSeriesData(dataset?.growth?.monthly?.mtom) ||
      hasValidSeriesData(dataset?.growth?.monthly?.yony_m) ||
      hasValidSeriesData(dataset?.growth?.monthly?.yony) ||
      hasValidSeriesData(dataset?.growth?.monthly?.ytod)
    );
  }

  if (aggregation === "quarterly") {
    return (
      hasValidSeriesData(dataset?.growth?.quarterly?.qtoq) ||
      hasValidSeriesData(dataset?.growth?.quarterly?.yony) ||
      hasValidSeriesData(dataset?.growth?.quarterly?.ctoc)
    );
  }

  if (aggregation === "yearly") {
    return hasValidSeriesData(dataset?.growth?.yearly);
  }

  return false;
};

const getSeriesByConfig = (dataset, cfg) => {
  const measure = cfg?.measure ?? "nilai";
  const aggregation =
    cfg?.aggregation ??
    (dataset.rawFrequency === "monthly"
      ? "monthly"
      : dataset.rawFrequency === "quarterly"
        ? "quarterly"
        : "yearly");

  const method =
    cfg?.method ??
    (aggregation === "monthly"
      ? "mtom"
      : aggregation === "quarterly"
        ? "qtoq"
        : "annual");

  if (measure === "nilai") {
    return {
      data: dataset?.series?.[aggregation] ?? [],
      periods: dataset?.derivedPeriods?.[aggregation] ?? [],
      aggregation,
    };
  }

  if (aggregation === "yearly") {
    const payload = dataset?.growth?.yearly ?? { data: [], periods: [] };

    if (Array.isArray(payload)) {
      return {
        data: payload,
        periods: dataset?.derivedPeriods?.yearly ?? [],
        aggregation,
      };
    }

    return {
      data: payload?.data ?? [],
      periods: payload?.periods ?? dataset?.derivedPeriods?.yearly ?? [],
      aggregation,
    };
  }

  if (aggregation === "monthly" && method === "yony") {
    const payload =
      dataset?.growth?.monthly?.yony_m ??
      dataset?.growth?.monthly?.yony ??
      { data: [], periods: [] };

    return {
      data: Array.isArray(payload) ? payload : payload?.data ?? [],
      periods: Array.isArray(payload?.periods)
        ? payload.periods
        : dataset?.derivedPeriods?.monthly ?? [],
      aggregation,
    };
  }

  const payload = dataset?.growth?.[aggregation]?.[method] ?? { data: [], periods: [] };

  return {
    data: Array.isArray(payload) ? payload : payload?.data ?? [],
    periods: Array.isArray(payload?.periods)
      ? payload.periods
      : dataset?.derivedPeriods?.[aggregation] ?? [],
    aggregation,
  };
};

const rawPreparedSeries = computed(() => getSeriesByConfig(props.datasets, config.value));

const preparedSeries = computed(() => {
  const measure = config.value?.measure ?? "nilai";
  const baseUnit = getDatasetUnitLabel(props.datasets, measure);
  const targetUnit = effectiveDisplayUnit.value;

  if (measure !== "nilai") {
    return rawPreparedSeries.value;
  }

  return convertSeriesMetaByUnit(rawPreparedSeries.value, baseUnit, targetUnit);
});

const getLastNonNull = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
};

const getLastTwoNonNull = (arr = []) => {
  const valid = arr.filter((v) => v !== null && v !== undefined);
  if (!valid.length) return { prev: null, last: null };
  if (valid.length === 1) return { prev: null, last: valid[0] };

  return {
    prev: valid[valid.length - 2],
    last: valid[valid.length - 1],
  };
};

const last = computed(() => getLastNonNull(preparedSeries.value.data ?? []));
const isGrowthMode = computed(() => (config.value?.measure ?? "nilai") === "pertumbuhan");

const displayValue = computed(() => {
  if (last.value === null || last.value === undefined) return "-";

  const suffix = isGrowthMode.value ? "%" : "";
  return `${formatChartNumber(last.value, {
    minFractionDigits: 0,
    maxFractionDigits: 2,
    fallback: "-",
  })}${suffix}`;
});

const metricSecondaryText = computed(() => {
  const latestNilaiRaw =
    getLastNonNull(props.datasets?.series?.monthly ?? []) ??
    getLastNonNull(props.datasets?.series?.quarterly ?? []) ??
    getLastNonNull(props.datasets?.series?.yearly ?? []);

  if (latestNilaiRaw === null || latestNilaiRaw === undefined) return "-";

  const converted = convertSeriesMetaByUnit(
    { data: [latestNilaiRaw], periods: [] },
    getDatasetUnitLabel(props.datasets, "nilai"),
    effectiveDisplayUnit.value
  );

  const value = converted?.data?.[0];
  return formatChartNumber(value, {
    minFractionDigits: 0,
    maxFractionDigits: 2,
    fallback: "-",
  });
});

const trendDirection = computed(() => {
  const { prev, last } = getLastTwoNonNull(preparedSeries.value?.data ?? []);
  if (prev === null || prev === undefined || last === null || last === undefined) return 0;
  if (last > prev) return 1;
  if (last < prev) return -1;
  return 0;
});

const isUp = computed(() => trendDirection.value >= 0);

const isSelected = computed(() => chartStore.isSelected(props.datasets.id));
const isPrimary = computed(() => chartStore.primaryId === props.datasets.id);
const isDisabled = computed(() => chartStore.isLocked && !isSelected.value);
const isExpanded = computed(() => chartStore.isExpanded(props.datasets.id));

const canChooseMonthly = computed(() =>
  datasetHasAggregationData(
    props.datasets,
    "monthly",
    config.value?.measure ?? "nilai"
  )
);

const canChooseQuarterly = computed(() =>
  datasetHasAggregationData(
    props.datasets,
    "quarterly",
    config.value?.measure ?? "nilai"
  )
);

const canChooseYearly = computed(() =>
  datasetHasAggregationData(
    props.datasets,
    "yearly",
    config.value?.measure ?? "nilai"
  )
);

const isCardMonthlyDisabled = computed(() => {
  if (!allowMonthlyByMeta.value) return true;
  if (!canChooseMonthly.value) return true;
  if (!props.isGabung) return false;
  return props.monthlyDisabled;
});

const isCardQuarterlyDisabled = computed(() => {
  if (!allowQuarterlyByMeta.value) return true;
  if (!canChooseQuarterly.value) return true;
  if (!props.isGabung) return false;
  return props.quarterlyDisabled;
});

const isCardYearlyDisabled = computed(() => {
  if (!allowYearlyByMeta.value) return true;
  return !canChooseYearly.value;
});

const showAggregationFilter = computed(() => !!config.value.measure);
const showMethodFilter = computed(
  () =>
    config.value.measure === "pertumbuhan" &&
    !!config.value.aggregation &&
    config.value.aggregation !== "yearly"
);

const currentMethodOptions = computed(() => {
  if (config.value?.aggregation === "monthly") {
    return FILTER_OPTIONS.monthlyMethods;
  }

  if (config.value?.aggregation === "quarterly") {
    return FILTER_OPTIONS.quarterlyMethods;
  }

  return [];
});

const methodLabel = computed(() => {
  if (config.value?.aggregation === "monthly") return "Metode Bulanan";
  if (config.value?.aggregation === "quarterly") return "Metode Triwulanan";
  return "Metode";
});

const onClickCard = () => {
  if (isDisabled.value) return;

  if (chartStore.selectedDataset.length > 1) {
    const confirmChange = window.confirm("Apakah ingin melihat chart ini saja?");
    if (!confirmChange) return;

    chartStore.showOnly(props.datasets);
    return;
  }

  chartStore.setPrimary(props.datasets);
};

const onToggleCompare = () => {
  if (isDisabled.value) return;
  chartStore.toggleCompare(props.datasets);
};

const onMeasureChange = (e) => {
  const measure = e.target.value;
  chartStore.setMeasure(props.datasets.id, measure);
};

const onAggregationChange = (e) => {
  const aggregation = e.target.value;
  chartStore.setAggregation(props.datasets.id, aggregation);

  if (aggregation === "monthly") {
    chartStore.setMethod(props.datasets.id, "mtom");
    return;
  }

  if (aggregation === "quarterly") {
    chartStore.setMethod(props.datasets.id, "qtoq");
    return;
  }

  if (aggregation === "yearly") {
    chartStore.setMethod(props.datasets.id, "annual");
  }
};

const onMethodChange = (e) => {
  chartStore.setMethod(props.datasets.id, e.target.value);
};

const onDisplayUnitChange = (e) => {
  chartStore.setDisplayUnit(props.datasets.id, e.target.value);
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
        <h2 class="truncate text-[14px] font-semibold theme-text" :title="datasets.indicatorName">
          {{ datasets.indicatorName }}
        </h2>

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
        <h2 class="text-[14px] font-semibold leading-tight theme-text">
          {{ displayValue }}
        </h2>

        <p
          class="text-[14px] font-semibold leading-tight"
          :class="isUp ? 'text-green-500' : 'text-red-500'"
        >
          {{ metricSecondaryText }}
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
        <label class="block text-[12px] mb-1 theme-text-muted">Pilih Periode</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.aggregation ?? ''"
          @change="onAggregationChange"
        >
          <option value="" disabled>Pilih periode</option>
          <option value="monthly" :disabled="isCardMonthlyDisabled">Bulanan</option>
          <option value="quarterly" :disabled="isCardQuarterlyDisabled">Triwulanan</option>
          <option value="yearly" :disabled="isCardYearlyDisabled">Tahunan</option>
        </select>

        <p
          v-if="!allowQuarterlyByMeta || !allowYearlyByMeta"
          class="text-[11px] mt-1 theme-text-muted"
        >
          Turunan periode dinonaktifkan karena nilai konversi pada endpoint kode adalah NaN.
        </p>

        <p
          v-else-if="!canChooseMonthly"
          class="text-[11px] mt-1 theme-text-muted"
        >
          Kode dengan prefix Q tidak bisa memilih periode bulanan.
        </p>
      </div>

      <div v-if="showMethodFilter" class="mt-3">
        <label class="block text-[12px] mb-1 theme-text-muted">{{ methodLabel }}</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="config.method ?? ''"
          @change="onMethodChange"
        >
          <option value="" disabled>Pilih metode</option>
          <option v-for="opt in currentMethodOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="showDisplayUnitFilter" class="mt-3">
        <label class="block text-[12px] mb-1 theme-text-muted">Satuan Rupiah</label>
        <select
          class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
          :value="effectiveDisplayUnit"
          @change="onDisplayUnitChange"
        >
          <option value="" disabled>Pilih satuan</option>
          <option
            v-for="opt in displayUnitOptions"
            :key="opt.value"
            :value="opt.value"
          >
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