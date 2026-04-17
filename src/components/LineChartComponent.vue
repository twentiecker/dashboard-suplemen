<script setup>
import { computed } from "vue";
import { useChartStore } from "../stores/useChartStore";

const props = defineProps({
  datasets: Object,
});

const chartStore = useChartStore();
const config = computed(() => chartStore.getCompareConfig(props.datasets));

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
    return dataset?.series?.[aggregation] ?? [];
  }

  if (aggregation === "yearly") {
    return dataset?.growth?.yearly?.data ?? [];
  }

  if (aggregation === "monthly" && method === "yony") {
    return (
      dataset?.growth?.monthly?.yony_m?.data ??
      dataset?.growth?.monthly?.yony?.data ??
      []
    );
  }

  return dataset?.growth?.[aggregation]?.[method]?.data ?? [];
};

const preparedSeries = computed(() => getSeriesByConfig(props.datasets, config.value));

const getLastTwoNonNull = (arr = []) => {
  const valid = arr.filter((v) => v !== null && v !== undefined);
  if (!valid.length) return { prev: null, last: null };
  if (valid.length === 1) return { prev: null, last: valid[0] };

  return {
    prev: valid[valid.length - 2],
    last: valid[valid.length - 1],
  };
};

const isDown = computed(() => {
  const { prev, last } = getLastTwoNonNull(preparedSeries.value ?? []);
  if (prev === null || prev === undefined || last === null || last === undefined) return false;
  return Number(last) < Number(prev);
});

const chartData = computed(() => {
  const borderColor = isDown.value ? "#EF4444" : "#22C55E";
  const series = preparedSeries.value ?? [];

  return {
    labels: series.map((_, i) => i + 1),
    datasets: [
      {
        label: props.datasets?.indicatorName ?? "",
        data: series,
        fill: false,
        borderColor,
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        spanGaps: true,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  events: [],
  layout: { padding: 0 },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: {
      display: false,
      grid: { display: false, drawBorder: false },
      ticks: { display: false },
      border: { display: false },
    },
    y: {
      display: false,
      grid: { display: false, drawBorder: false },
      ticks: { display: false },
      border: { display: false },
    },
  },
  animation: false,
}));
</script>

<template>
  <div class="w-full h-full">
    <Chart
      type="line"
      :data="chartData"
      :options="chartOptions"
      class="w-full h-full block"
    />
  </div>
</template>

<style scoped>
:deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
}
</style>