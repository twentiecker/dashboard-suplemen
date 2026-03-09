<script setup>
import { computed } from "vue";
import { useChartStore } from "../stores/useChartStore";
import LineChartComponent from "./LineChartComponent.vue";

const props = defineProps({
  datasets: Object,
});

const chartStore = useChartStore();

const last = computed(() => {
  const arr = props.datasets.data;
  return arr[arr.length - 1];
});

const prev = computed(() => {
  const arr = props.datasets.data;
  return arr[arr.length - 2];
});

const isUp = computed(() => (last.value ?? 0) - (prev.value ?? 0) >= 0);

const growthPct = computed(() => {
  const l = Number(last.value ?? 0);
  const p = Number(prev.value ?? 0);
  if (!p) return 0;
  return ((l - p) / p) * 100;
});

const growthText = computed(() => {
  const v = growthPct.value;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
});

const isSelected = computed(() => chartStore.isSelected(props.datasets.id));
const isPrimary = computed(() => chartStore.primaryId === props.datasets.id);
const isDisabled = computed(() => chartStore.isLocked && !isSelected.value);

const onClickCard = () => {
  if (isDisabled.value) return;

  const selectedCount = chartStore.selectedDataset?.length ?? 0;
  if (selectedCount > 1 && !isSelected.value) {
    const viewOnly = window.confirm(
      "Kamu sudah memilih lebih dari 1 chart.\n\nOK: lihat chart ini saja (mengganti pilihan)\nCancel: tambahkan chart ini"
    );

    if (viewOnly) {
      chartStore.setPrimary(props.datasets); 
    } else {
      chartStore.addCompare(props.datasets); 
    }
    return;
  }

  // default behavior (tetap)
  chartStore.setPrimary(props.datasets);
};

const onToggleCompare = () => {
  if (isSelected.value) chartStore.removeSelected(props.datasets);
  else chartStore.addCompare(props.datasets);
};
</script>

<template>
  <div
    class="w-full px-3 py-2 cursor-pointer select-none"
    :class="[
      isPrimary ? 'border-l-3 border-blue-500' : '',
      isDisabled ? 'opacity-40 cursor-not-allowed' : ''
    ]"
    @click="onClickCard"
  >
    <div
      class="grid items-center w-full gap-x-3 min-w-0"
      style="
        grid-template-columns:
          minmax(50px, 10px)
          1fr
          minmax(40px, 10px)
          32px;
      "
    >
      <!-- KIRI -->
      <div class="min-w-0">
        <h1 class="text-sm font-semibold truncate" :title="datasets.indicatorName">
          {{ datasets.indicatorName }}
        </h1>

        <p class="text-xs opacity-70 truncate">
          {{ datasets.groupCode }}
        </p>
      </div>

      <!-- SPARKLINE -->
      <div class="min-w-0 w-full">
        <div class="h-12 w-full">
          <LineChartComponent :datasets="datasets" class="w-full h-full" />
        </div>
      </div>

      <!-- VALUE -->
      <div class="text-right min-w-0">
        <h1 class="text-sm font-semibold" :class="isUp ? 'text-green-500' : 'text-red-500'">
          {{ Number(last).toFixed(1) }}
        </h1>
        <p class="text-xs opacity-80" :class="isUp ? 'text-green-500' : 'text-red-500'">
          {{ growthText }}
        </p>
      </div>

      <!-- ICON -->
      <button
        class="w-10 h-10 grid place-items-center rounded-full overflow-visible"
        :class="(isDisabled && !isSelected) ? 'pointer-events-none' : ''"
        @click.stop="onToggleCompare"
        type="button"
      >
        <i
          class="text-2xl leading-none"
          :class="isSelected ? 'pi pi-minus-circle hover:text-red-500' : 'pi pi-plus-circle hover:text-blue-500'"
        />
      </button>
    </div>
  </div>
</template>