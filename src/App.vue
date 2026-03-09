<script setup>
import { ref, onMounted, computed } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";

const isGabung = ref(false);
const chartStore = useChartStore();

/** ============
 * DATA CARD
 * ============= */
const cards = [
  {
    id: "1",
    label: "QA101",
    indicatorName: "Indeks Penjualan Eceran Riil Suku cadang dan aksesoris",
    groupCode: "QA101",
    frequency: "monthly",
    data: [150.8, 152.1, 149.4, 162.9, 160.2, 163.8, 157.4, 155.9, 158.6, 155.1, 154.8, 156.2],
    tension: 0.4,
  },
  {
    id: "2",
    label: "QA102",
    indicatorName: "Indeks Penjualan Eceran Riil Makanan, minuman, dan tembakau",
    groupCode: "QA102",
    frequency: "monthly",
    data: [238.8, 242.3, 236.1, 255.6, 251.2, 257.4, 232.8, 229.6, 235.9, 243.9, 241.0, 246.0],
    tension: 0.4,
  },
  {
    id: "3",
    label: "QA103",
    indicatorName: "Indeks Penjualan Eceran Riil Bahan bakar kendaraan bermotor",
    groupCode: "QA103",
    frequency: "monthly",
    data: [117.2, 120.6, 115.8, 128.5, 124.9, 129.7, 121.0, 118.4, 122.6, 127.9, 126.0, 128.3],
    tension: 0.4,
  },
  {
    id: "4",
    label: "QA104",
    indicatorName: "Indeks Penjualan Eceran Riil Perlengkapan rumah tangga lainnya",
    groupCode: "QA104",
    frequency: "monthly",
    data: [83.2, 84.5, 82.1, 90.4, 88.7, 91.6, 86.2, 84.9, 87.3, 92.8, 92.5, 91.0],
    tension: 0.4,
  },
  {
    id: "5",
    label: "QA105",
    indicatorName: "Indeks Penjualan Eceran Riil Peralatan informasi dan komunikasi",
    groupCode: "QA105",
    frequency: "monthly",
    data: [132.9, 135.2, 131.1, 137.1, 134.6, 138.8, 129.4, 127.9, 131.6, 141.5, 141.8, 139.9],
    tension: 0.4,
  },
  {
    id: "6",
    label: "QA106",
    indicatorName: "Indeks Penjualan Eceran Riil Barang budaya dan rekreasi",
    groupCode: "QA106",
    frequency: "monthly",
    data: [76.6, 78.4, 75.2, 83.4, 81.1, 84.6, 79.1, 77.5, 80.3, 88.4, 88.9, 87.2],
    tension: 0.4,
  },
];

onMounted(() => {
  chartStore.initPrimary(cards[0]);
});

/* =============================
 * THEME
 * ============================= */
const theme = computed(() => {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue("--p-primary-500"),
    text: style.getPropertyValue("--p-text-color"),
    textSecondary: style.getPropertyValue("--p-text-muted-color"),
    border: style.getPropertyValue("--p-content-border-color"),
  };
});

/* =============================
 * LABELS
 * ============================= */
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthQuarterLabels = [
  ["Jan", ""],
  ["Feb", ""],
  ["Mar", "Q1"],
  ["Apr", ""],
  ["May", ""],
  ["Jun", "Q2"],
  ["Jul", ""],
  ["Aug", ""],
  ["Sep", "Q3"],
  ["Oct", ""],
  ["Nov", ""],
  ["Dec", "Q4"],
];const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];

/* =============================
 * Primary frequency
 * ============================= */
const primaryDataset = computed(() => chartStore.selectedDataset?.[0] ?? null);

const leftXAxisLabels = computed(() => {
  if (!primaryDataset.value) return monthLabels;

  if (primaryDataset.value.frequency === "quarterly") {
    return quarterLabels;
  }

  return isGabung.value ? monthQuarterLabels : monthLabels;
});
const rightXAxisLabels = computed(() => quarterLabels);
const palette = [
  { line: "#3B82F6", fill: "rgba(59,130,246,0.18)" },
  { line: "#F59E0B", fill: "rgba(245,158,11,0.18)" },
  { line: "#A855F7", fill: "rgba(168,85,247,0.18)" },
  { line: "#22C55E", fill: "rgba(34,197,94,0.18)" },
  { line: "#EF4444", fill: "rgba(239,68,68,0.18)" },
];

/* =============================
 * STATIC DATASET kanan
 * ============================= */
const staticDataset = computed(() => ({
  id: "static",
  label: "Static Dataset",
  frequency: "quarterly",
  data: [22, 52, 13, 41],
  tension: 0.4,
  isStatic: true,
}));

/* =============================
 * Helper:
 * ============================= */
const expandQuarterlyToMonthly = (quarterData) => {
  return [
    null,
    null,
    quarterData[0] ?? null, // Mar = Q1
    null,
    null,
    quarterData[1] ?? null, // Jun = Q2
    null,
    null,
    quarterData[2] ?? null, // Sep = Q3
    null,
    null,
    quarterData[3] ?? null, // Dec = Q4
  ];
};

const normalizeDataForLeftChart = (dataset, primaryFrequency) => {
  if (primaryFrequency === "quarterly") {
    return dataset.frequency === "quarterly"
      ? dataset.data
      : [dataset.data[2], dataset.data[5], dataset.data[8], dataset.data[11]];
  }

  return dataset.frequency === "quarterly"
    ? expandQuarterlyToMonthly(dataset.data)
    : dataset.data;
};

/* =============================
 * CHART DATA LEFT
 * ============================= */
const chartDataL = computed(() => {
  const primaryFrequency = primaryDataset.value?.frequency ?? "monthly";

  const dyn = chartStore.selectedDataset.map((ds, idx) => {
    const colors = palette[idx] ?? palette[0];

    return {
      ...ds,
      label: ds.indicatorName,
      data: normalizeDataForLeftChart(ds, primaryFrequency),
      fill: true,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      yAxisID: "y",
      xAxisID: "x",
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
    };
  });

  if (isGabung.value) {
    dyn.push({
      ...staticDataset.value,
      data: normalizeDataForLeftChart(staticDataset.value, primaryFrequency),
      fill: true,
      borderColor: theme.value.primary,
      backgroundColor: "rgba(16, 185, 129, 0.18)",
      yAxisID: "y1",
      xAxisID: "x",
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
    });
  }

  return {
    labels: leftXAxisLabels.value,
    datasets: dyn,
  };
});

/* =============================
 * CHART DATA RIGHT
 * ============================= */
const chartDataR = computed(() => ({
  labels: rightXAxisLabels.value,
  datasets: [
    {
      ...staticDataset.value,
      fill: true,
      borderColor: theme.value.primary,
      backgroundColor: "rgba(16, 185, 129, 0.18)",
      tension: 0.4,
      yAxisID: "y",
      xAxisID: "x",
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ],
}));

/* =============================
 * VALUE LABEL PLUGIN
 * ============================= */
const valueLabelPlugin = {
  id: "valueLabelPlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (dataset?.isStatic) return;
      if (datasetIndex !== 0) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((point, i) => {
        const val = dataset.data[i];
        if (val === null || val === undefined) return;

        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.fillStyle = theme.value.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(val, point.x, point.y - 6);
        ctx.restore();
      });
    });
  },
};

/* =============================
 * CHART OPTIONS
 * ============================= */
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      left: 14,
      right: 28,
      top: 16,
      bottom: 8,
    },
  },
  plugins: {
    legend: {
      labels: { color: theme.value.text },
    },
    tooltip: {
      enabled: true,
    },
  },
  scales: {
    x: {
      position: "bottom",
      ticks: {
        color: theme.value.textSecondary,
        maxRotation: 0,
        minRotation: 0,
        padding: 10,
      },
      grid: { color: theme.value.border },
    },
    y: {
      position: "left",
      ticks: { color: theme.value.textSecondary },
      grid: { color: theme.value.border },
    },
    y1: {
      position: "right",
      display: isGabung.value,
      ticks: { color: theme.value.textSecondary },
      grid: { drawOnChartArea: false },
    },
  },
}));
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <!-- Kolom kiri -->
    <div class="h-full w-[320px] max-w-[360px] min-w-[260px] shrink-0 overflow-y-auto overflow-x-hidden">
      <div class="flex flex-col gap-1">
        <CardComponent
          v-for="card in cards"
          :key="card.id"
          :datasets="card"
        />
      </div>
    </div>

    <!-- kolom kanan -->
    <div class="flex-8 h-full overflow-hidden">
      <div class="p-4 h-full overflow-auto">
        <Button
          :label="isGabung ? 'Pisahkan' : 'Gabungkan'"
          :outlined="!isGabung"
          rounded
          @click="isGabung = !isGabung"
        />

        <div class="flex gap-6 mt-3">
          <!-- LEFT chart -->
          <div class="flex-1 min-w-0">
            <Chart
              type="line"
              :data="chartDataL"
              :options="chartOptions"
              :plugins="[valueLabelPlugin]"
              class="h-120 chart-left-dynamic"
            />
          </div>

          <!-- RIGHT chart -->
          <div v-if="!isGabung" class="flex-1 min-w-0">
            <Chart
              type="line"
              :data="chartDataR"
              :options="chartOptions"
              class="h-120"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>