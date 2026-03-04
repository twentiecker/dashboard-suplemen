<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";

const isGabung = ref(false);
const chartStore = useChartStore();

const cards = [
  {
    id: "1",
    label: "First",
    data: [12, 51, 62, 33, 21, 62, 45],
    tension: 0.4,
    isSelected: true,
    isAdded: false,
  },
  {
    id: "2",
    label: "Second",
    data: [45, 39, 60, 61, 36, 35, 20],
    tension: 0.4,
    isSelected: false,
    isAdded: false,
  },
  {
    id: "3",
    label: "Third",
    data: [15, 69, 40, 31, 16, 55, 60],
    tension: 0.4,
    isSelected: false,
    isAdded: false,
  },
];

const selectCard = (index) => {
  cards.forEach((card, i) => {
    if (i === index) {
      card.isSelected = true;
    } else {
      card.isSelected = false;
    }
  });
};
onMounted(() => {
  chartStore.setDataset(cards.slice(0, 1));
});

/* ============================= */
/* THEME (ambil sekali aja) */
/* ============================= */
const theme = computed(() => {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue("--p-primary-500"),
    text: style.getPropertyValue("--p-text-color"),
    textSecondary: style.getPropertyValue("--p-text-muted-color"),
    border: style.getPropertyValue("--p-content-border-color"),
  };
});

/* ============================= */
/* CHART OPTIONS (shared) */
/* ============================= */
const chartOptions = computed(() => ({
  maintainAspectRatio: false,
  aspectRatio: 0.6,
  plugins: {
    legend: {
      labels: {
        color: theme.value.text,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: theme.value.textSecondary },
      grid: { color: theme.value.border },
    },
    y: {
      ticks: { color: theme.value.textSecondary },
      grid: { color: theme.value.border },
    },
  },
}));

/* ============================= */
/* CHART DATA LEFT */
/* ============================= */
const chartDataL = computed(() => {
  const baseDatasets = chartStore.selectedDataset.map((ds) => {
    const data = Object.entries(ds.data).map((item) => item[1]);
    const dataLength = data.length;
    const borderColor =
      data[dataLength - 1] - data[dataLength - 2] < 0 ? "#EF4444" : "#22C55E";
    const backgroundColor =
      data[dataLength - 1] - data[dataLength - 2] < 0
        ? "rgba(239, 68, 68, 0.2)"
        : "rgba(34, 197, 94, 0.2)";

    return {
      ...ds,
      fill: true,
      borderColor,
      backgroundColor,
    };
  });

  if (isGabung.value) {
    baseDatasets.push({
      label: "Second Dataset",
      data: [22, 31, 52, 13, 41, 32, 25],
      fill: true,
      borderColor: theme.value.primary,
      tension: 0.4,
      backgroundColor: "rgba(59, 130, 246, 0.2)",
    });
  }

  return {
    labels: ["January", "February", "March", "April", "May", "June", "July"],
    datasets: baseDatasets,
  };
});

/* ============================= */
/* CHART DATA RIGHT */
/* ============================= */

const chartDataR = computed(() => ({
  labels: ["January", "February", "March", "April", "May", "June", "July"],
  datasets: [
    {
      label: "Second Dataset",
      data: [22, 31, 52, 13, 41, 32, 25],
      fill: true,
      borderColor: theme.value.primary,
      tension: 0.4,
      backgroundColor: "rgba(59, 130, 246, 0.2)",
    },
  ],
}));
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
    <!-- Kolom kiri -->
    <div class="flex-2 h-full shrink-0 overflow-auto">
      <div class="flex flex-col gap-1">
        <CardComponent
          v-for="(card, index) in cards"
          :key="card.id"
          :datasets="card"
          @click="selectCard(index)"
        />
      </div>
    </div>

    <!-- kolom kanan -->
    <div class="flex-8 h-full overflow-hidden">
      <div class="p-4 h-full overflow-auto">
        <Button
          :label="isGabung ? 'Pisahkan' : 'Gabungkan'"
          :outlined="isGabung ? false : true"
          rounded
          @click="isGabung = !isGabung"
        />
        <div class="flex justify-between">
          <div class="flex-1 w-min-0">
            <Chart
              type="line"
              :data="chartDataL"
              :options="chartOptions"
              class="h-120"
            />
          </div>
          <div v-if="!isGabung" class="flex-1 w-min-0">
            <Chart
              type="line"
              :data="chartDataR"
              :options="chartOptions"
              class="h-120"
            />
          </div>
        </div>
        {{ chartStore.selectedDataset }}
      </div>
    </div>
  </div>
</template>
