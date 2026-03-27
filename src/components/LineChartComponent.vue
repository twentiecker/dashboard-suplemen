<script setup>
import { computed } from "vue";
import { useChartStore } from "../stores/useChartStore";

const props = defineProps({
  datasets: Object,
});

const chartStore = useChartStore();

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

const sumSafe = (arr) => arr.reduce((a, b) => a + Number(b ?? 0), 0);

const growthPercent = (current, previous) => {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    Number(previous) === 0
  ) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const computeMonthlyGrowth = (values, method) => {
  return values.map((val, i) => {
    if (val === null || val === undefined) return null;

    if (method === "mtm") {
      return growthPercent(val, values[i - 1]);
    }

    if (method === "yoy") {
      return growthPercent(val, values[i - 12]);
    }

    if (method === "ytd") {
      if (i < 12) return null;

      const monthInYear = i % 12;
      const currentYearStart = i - monthInYear;
      const prevYearStart = currentYearStart - 12;

      if (prevYearStart < 0) return null;

      const currentCum = sumSafe(values.slice(currentYearStart, i + 1));
      const prevCum = sumSafe(values.slice(prevYearStart, prevYearStart + monthInYear + 1));

      return growthPercent(currentCum, prevCum);
    }

    return null;
  });
};

const computeQuarterlyGrowth = (values, method) => {
  return values.map((val, i) => {
    if (val === null || val === undefined) return null;

    if (method === "qtq") {
      return growthPercent(val, values[i - 1]);
    }

    if (method === "yoy") {
      return growthPercent(val, values[i - 4]);
    }

    if (method === "ctc") {
      if (i < 4) return null;

      const quarterPos = i % 4;
      const currentYearStart = i - quarterPos;
      const prevYearStart = currentYearStart - 4;

      if (prevYearStart < 0) return null;

      const currentCum = sumSafe(values.slice(currentYearStart, i + 1));
      const prevCum = sumSafe(values.slice(prevYearStart, prevYearStart + quarterPos + 1));

      return growthPercent(currentCum, prevCum);
    }

    return null;
  });
};

const getBaseSeries = (dataset, aggregation) => {
  if (aggregation === "monthly") {
    return dataset.series.monthly ?? [];
  }

  if (dataset.rawFrequency === "quarterly") return dataset.series.quarterly ?? [];

  return monthlyToQuarterlyByPeriods(dataset.series.monthly ?? [], dataset.periods ?? []);
};

const preparedSeries = computed(() => {
  const measure = config.value?.measure ?? "nilai";
  const aggregation =
    config.value?.aggregation ??
    (props.datasets.rawFrequency === "quarterly" ? "quarterly" : "monthly");
  const method = config.value?.method ?? (aggregation === "monthly" ? "mtm" : "qtq");

  const baseSeries = getBaseSeries(props.datasets, aggregation);

  if (measure === "nilai") return baseSeries;

  if (aggregation === "monthly") {
    return computeMonthlyGrowth(baseSeries, method);
  }

  return computeQuarterlyGrowth(baseSeries, method);
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

const lastVal = computed(() => getLastNonNull(preparedSeries.value));
const prevVal = computed(() => getPrevNonNull(preparedSeries.value));

const isDown = computed(() => {
  const l = Number(lastVal.value ?? 0);
  const p = Number(prevVal.value ?? 0);
  return l - p < 0;
});

const chartData = computed(() => {
  const borderColor = isDown.value ? "#EF4444" : "#22C55E";

  return {
    labels: preparedSeries.value.map((_, i) => i + 1),
    datasets: [
      {
        label: props.datasets.indicatorName,
        data: preparedSeries.value,
        fill: false,
        borderColor,
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0,
        cubicInterpolationMode: "monotone",
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 0,
        pointBorderWidth: 0,
        pointBackgroundColor: "transparent",
        pointBorderColor: "transparent",
        spanGaps: true,
      },
    ],
  };
});

const chartOptions = computed(() => {
  return {
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
        offset: false,
        grid: { display: false, drawBorder: false },
        ticks: { display: false },
        border: { display: false },
      },
      y: {
        display: false,
        offset: false,
        grid: { display: false, drawBorder: false },
        ticks: { display: false },
        border: { display: false },
      },
    },
    elements: {
      line: {
        tension: 0,
        borderJoinStyle: "round",
        borderCapStyle: "round",
      },
      point: {
        radius: 0,
        hoverRadius: 0,
      },
    },
    animation: false,
  };
});
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
