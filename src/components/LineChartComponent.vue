<script setup>
import { ref, onMounted } from "vue";

onMounted(() => {
  chartData.value = setChartData();
  chartOptions.value = setChartOptions();
});

const props = defineProps({
  datasets: Object,
});

const chartData = ref();
const chartOptions = ref();

const setChartData = () => {
  const documentStyle = getComputedStyle(document.documentElement);
  const dataLength = props.datasets.data.length;
  const borderColor =
    props.datasets.data[dataLength - 1] - props.datasets.data[dataLength - 2] <
    0
      ? "#EF4444"
      : "#22C55E";
  const backgroundColor =
    props.datasets.data[dataLength - 1] - props.datasets.data[dataLength - 2] <
    0
      ? "rgba(239, 68, 68, 0.2)"
      : "rgba(34, 197, 94, 0.2)";

  const datasets = [
    {
      ...props.datasets,
      fill: false,
      borderColor,
      backgroundColor,
    },
  ];

  return {
    labels: ["January", "February", "March", "April", "May", "June", "July"],
    datasets,
  };
};
const setChartOptions = () => {
  const documentStyle = getComputedStyle(document.documentElement);
  const textColor = documentStyle.getPropertyValue("--p-text-color");
  const textColorSecondary = documentStyle.getPropertyValue(
    "--p-text-muted-color",
  );
  const surfaceBorder = documentStyle.getPropertyValue(
    "--p-content-border-color",
  );

  return {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 0.6,
    events: [], // 🔥 disable semua mouse event
    plugins: {
      legend: {
        display: false,
        labels: {
          color: textColor,
        },
      },
    },
    scales: {
      x: {
        display: false,
        ticks: {
          color: textColorSecondary,
        },
        grid: {
          color: surfaceBorder,
        },
      },
      y: {
        display: false,
        ticks: {
          color: textColorSecondary,
        },
        grid: {
          color: surfaceBorder,
        },
      },
    },
  };
};
</script>

<template>
  <Chart
    type="line"
    :data="chartData"
    :options="chartOptions"
    class="h-full w-full"
  />
</template>
