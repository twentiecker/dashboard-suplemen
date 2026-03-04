<script setup>
import { computed, ref } from "vue";
import { useChartStore } from "../stores/useChartStore";
import LineChartComponent from "./LineChartComponent.vue";

const props = defineProps({
  datasets: Object,
});
const chartStore = useChartStore();
const selectDataset = (dataset) => {
  chartStore.setDataset(dataset);
};
const addDataset = (dataset) => {
  console.log(props.datasets.id);

  const temp = chartStore.selectedDataset.length;
  chartStore.addDataset(dataset);
  if (chartStore.selectedDataset.length > temp) isAdded.value = !isAdded.value;
  // if (chartStore.selectedDataset.length > temp) chartStore.setIsAdded(dataset);
};
const deleteDataset = (dataset) => {
  chartStore.deleteDataset(dataset);
  isAdded.value = !isAdded.value;
};
// const isAdded = computed(() => chartStore.selectedDataset);
const isAdded = ref(false);
</script>

<template>
  <div
    class="flex w-full gap-2 items-center pl-3 cursor-pointer"
    :class="datasets.isSelected ? 'border-l-3 border-blue-500' : ''"
    @click="selectDataset([datasets])"
  >
    <div class="flex flex-col">
      <h1 class="text-sm">Title</h1>
      <p class="text-xs">Subtitle</p>
    </div>
    <div class="flex-1 h-12 min-w-0">
      <LineChartComponent :datasets="datasets" />
    </div>
    <div class="">
      <h1 class="text-sm">Value</h1>
      <p class="text-xs">Subvalue</p>
    </div>
    <i
      class="mx-2"
      :class="
        isAdded
          ? 'pi pi-minus-circle hover:text-red-500'
          : 'pi pi-plus-circle hover:text-blue-500'
      "
      @click.stop="isAdded ? deleteDataset(datasets) : addDataset(datasets)"
    ></i>
  </div>
</template>
