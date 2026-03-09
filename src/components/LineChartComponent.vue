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
  const dataLength = props.datasets.data.length;

  const isDown =
    props.datasets.data[dataLength - 1] - props.datasets.data[dataLength - 2] < 0;

  const borderColor = isDown ? "#EF4444" : "#22C55E";

  const datasets = [
    {
      ...props.datasets,
      fill: false,
      borderColor,
      backgroundColor: "transparent",
      borderWidth: 2,

      tension: 0,
      cubicInterpolationMode: "monotone",

      pointRadius: 2,
      pointHoverRadius: 2,
      pointHitRadius: 0,
      pointBorderWidth: 0,
      pointBackgroundColor: borderColor,
    },
  ];

  return {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets,
  };
};

const setChartOptions = () => {
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
        radius: 2,
        hoverRadius: 2,
      },
    },
    animation: false,
  };
};
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