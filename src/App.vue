<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";
import LeftPanel from "./components/LeftPanel.vue";
import RightPanel from "./components/RightPanel.vue";

import {
  provinceOptions,
  rangeButtons,
  FILTER_OPTIONS,
  LOADING_STAGES,
  TOTAL_BAR_COLOR,
} from "./constants/appChartConstants";

import { wait, waitUntil } from "./utils/asyncHelpers";

import {
  normalizeTextKey,
  normalizeUnitLabel,
  getAvailableDisplayUnits,
  convertSeriesMetaByUnit,
  getDatasetDisplayName,
  trimMetaByRange,
  normalizeYearLikePeriod,
  parsePeriod,
  getSeriesMeta,
  toPointData,
  aggregationToAxisId,
  getDatasetStackColor,
  createDatasetTooltipMeta,
  buildDatasetStyle,
  formatChartNumber,
} from "./utils/chartHelpers";

import { useLoadingOverlay } from "./composables/useLoadingOverlay";
import { useDataLoader } from "./composables/useDataLoader";
import { useFilterLogic } from "./composables/useFilterLogic";
import { useChartLogic } from "./composables/useChartLogic";
import { useMergeAnimation } from "./composables/useMergeAnimation";

const chartStore = useChartStore();

const staticComponent = ref("");
const staticPeriod = ref("");
const staticMethod = ref("");
const staticMeasure = ref("pertumbuhan");
const staticDisplayUnit = ref("");

const dynamicChartType = ref("line");
const staticChartType = ref("line");
const combineBarMode = ref("standard");

const selectedProvince = ref("indonesia");
const selectedRange = ref("8Y");

const componentRuleMode = ref("admin");

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);

const isPageBusy = ref(false);

const isPresetPopoverOpen = ref(false);
const presetPopoverRef = ref(null);

const presetActionMessage = ref("");
const presetActionType = ref("");
let presetMessageTimer = null;

const togglePresetPopover = () => {
  if (!canSaveCurrentIndicator.value) return;
  isPresetPopoverOpen.value = !isPresetPopoverOpen.value;

  if (!isPresetPopoverOpen.value) {
    clearPresetMessage();
  }
};

const closePresetPopover = () => {
  isPresetPopoverOpen.value = false;
  clearPresetMessage();
};

const showPresetMessage = (message, type = "success") => {
  presetActionMessage.value = message;
  presetActionType.value = type;

  if (presetMessageTimer) {
    clearTimeout(presetMessageTimer);
  }

  presetMessageTimer = window.setTimeout(() => {
    presetActionMessage.value = "";
    presetActionType.value = "";
    presetMessageTimer = null;
  }, 1800);
};

const clearPresetMessage = () => {
  presetActionMessage.value = "";
  presetActionType.value = "";

  if (presetMessageTimer) {
    clearTimeout(presetMessageTimer);
    presetMessageTimer = null;
  }
};

const handleDocumentClick = (event) => {
  if (!isPresetPopoverOpen.value) return;

  const root = presetPopoverRef.value;
  if (!root) return;

  if (!root.contains(event.target)) {
    closePresetPopover();
  }
};

const {
  loadingStageText,
  loadingProgressText,
  loadingPulseKey,
  loadingPercent,
  startLoadingStageAnimation,
  finishLoadingStageAnimation,
  stopLoadingStageAnimation,
} = useLoadingOverlay({
  stages: LOADING_STAGES,
  wait,
});

const {
  activeStaticDataset,
  activeMappedSource,
  dynamicIndicatorUnitMap,
  cards,
  isLoadingCards,
  filteredPdbIndicatorOptions,
  globalComponentOptions,
  loadPdbComponentOptions,
  loadActiveStaticDataset,
  reloadBySelectedComponent,
  resetAllDataState,
} = useDataLoader({
  chartStore,
  staticComponent,
  staticMeasure,
  componentRuleMode,
});

const primaryDataset = computed(() => chartStore.selectedDataset?.[0] ?? null);

const primaryMeasure = computed(() => {
  if (!primaryDataset.value) return "";
  const id = String(primaryDataset.value.id);
  return chartStore.compareConfigs[id]?.measure ?? "";
});

const canSaveCurrentIndicator = computed(() => {
  return !!primaryDataset.value && chartStore.selectedCount === 1 && !isGabung.value;
});

const primarySavedSlots = computed(() => {
  if (!primaryDataset.value) return {};
  return chartStore.getSavedSlotsByDatasetId(primaryDataset.value.id);
});

const hasSavedSlot1 = computed(() => !!primarySavedSlots.value?.slot1);
const hasSavedSlot2 = computed(() => !!primarySavedSlots.value?.slot2);

const saveStatusText = computed(() => {
  if (!primaryDataset.value) return "Pilih 1 indikator untuk menggunakan preset tampilan.";
  if (isGabung.value) return "Preset dinonaktifkan saat mode gabung aktif.";
  if (chartStore.selectedCount !== 1) return "Preset hanya aktif saat 1 indikator dipilih.";
  return "Simpan atau muat ulang kondisi dua chart untuk indikator aktif.";
});

const formatSavedAt = (timestamp) => {
  if (!timestamp) return "";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
};

const slot1Meta = computed(() => primarySavedSlots.value?.slot1 ?? null);
const slot2Meta = computed(() => primarySavedSlots.value?.slot2 ?? null);

const slot1SavedAtText = computed(() => formatSavedAt(slot1Meta.value?.savedAt));
const slot2SavedAtText = computed(() => formatSavedAt(slot2Meta.value?.savedAt));

const presetNameDrafts = ref({
  1: "",
  2: "",
});

const getSlotCustomName = (slot) => {
  const meta = slot === 1 ? slot1Meta.value : slot2Meta.value;
  return String(meta?.customName ?? `Preset ${slot}`);
};

const openRenameDraft = (slot) => {
  presetNameDrafts.value[slot] = getSlotCustomName(slot);
};

watch(
  isPresetPopoverOpen,
  (open) => {
    if (!open) return;
    presetNameDrafts.value[1] = getSlotCustomName(1);
    presetNameDrafts.value[2] = getSlotCustomName(2);
  },
  { immediate: false }
);

const handleRenameSlot = (slot) => {
  if (!primaryDataset.value) return;

  const success = chartStore.renameSavedIndicatorState(
    primaryDataset.value.id,
    slot,
    presetNameDrafts.value[slot]
  );

  if (!success) return;

  showPresetMessage(`Nama preset ${slot} diperbarui`, "success");
};

const getSlotStatusLabel = (hasSaved) => {
  return hasSaved ? "Saved" : "Empty";
};

const handleClearSlot = (slot) => {
  if (!primaryDataset.value) return;
  if (!canSaveCurrentIndicator.value) return;

  const cleared = chartStore.clearSavedIndicatorState(primaryDataset.value.id, slot);
  if (!cleared) return;

  showPresetMessage(`Preset ${slot} dihapus`, "info");
};

const isGabungBridge = ref(false);
const isCombineDisabledBridge = ref(false);

const hasStaticNilaiQuarterlyBridge = ref(false);
const hasStaticNilaiYearlyBridge = ref(false);
const hasStaticGrowthQuarterlyBridge = ref(false);
const hasStaticGrowthYearlyBridge = ref(false);

const {
  primaryAggregation,
  primaryMethod,
  canChoosePrimaryMonthly,
  canChoosePrimaryQuarterly,
  canChoosePrimaryYearly,
  onPrimaryMeasureChange,
  onPrimaryAggregationChange,
  onPrimaryMethodChange,
  showPrimaryAggregationFilter,
  showPrimaryMethodFilter,
  showStaticPeriodFilter,
  showStaticMethodFilter,
  isPrimaryMonthlyDisabled,
  isPrimaryQuarterlyDisabled,
  isPrimaryYearlyDisabled,
  isStaticQuarterlyDisabled,
  isStaticYearlyDisabled,
  isCardMonthlyDisabled,
  isCardQuarterlyDisabled,
  isCombineDisabled,
  combineDisabledMessage,
} = useFilterLogic({
  chartStore,
  isGabung: isGabungBridge,
  primaryDataset,
  primaryMeasure,
  staticComponent,
  staticPeriod,
  staticMeasure,
  activeStaticDataset,
  activeMappedSource,
  hasStaticNilaiQuarterly: hasStaticNilaiQuarterlyBridge,
  hasStaticNilaiYearly: hasStaticNilaiYearlyBridge,
  hasStaticGrowthQuarterly: hasStaticGrowthQuarterlyBridge,
  hasStaticGrowthYearly: hasStaticGrowthYearlyBridge,
});

const {
  isGabung,
  isMerging,
  mergePhase,
  snapshotPiecesVisible,
  snapshotPieces,
  onToggleGabung,
} = useMergeAnimation({
  leftPanelRef,
  rightPanelRef,
  isPageBusy,
  isCombineDisabled: isCombineDisabledBridge,
});

watch(
  isGabung,
  (val) => {
    isGabungBridge.value = val;
    if (val) closePresetPopover();
  },
  { immediate: true }
);

watch(
  isCombineDisabled,
  (val) => {
    isCombineDisabledBridge.value = val;
  },
  { immediate: true }
);

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
    for (const code of codeCandidates) {
      if (dynamicIndicatorUnitMap.value[code]) {
        rawUnit = dynamicIndicatorUnitMap.value[code];
        break;
      }
    }
  }

  if (!rawUnit) {
    for (const name of nameCandidates) {
      if (dynamicIndicatorUnitMap.value[`name:${name}`]) {
        rawUnit = dynamicIndicatorUnitMap.value[`name:${name}`];
        break;
      }
    }
  }

  return normalizeUnitLabel(rawUnit, "Nilai");
}

const primaryBaseUnitLabel = computed(() => {
  if (!primaryDataset.value) return "";
  return getDatasetUnitLabel(primaryDataset.value, primaryMeasure.value || "nilai");
});

const primaryDisplayUnitOptions = computed(() => {
  const available = getAvailableDisplayUnits(primaryBaseUnitLabel.value);
  return available.map((unit) => ({
    value: unit,
    label: unit,
  }));
});

const primaryDisplayUnit = computed(() => {
  if (!primaryDataset.value) return "";

  const id = String(primaryDataset.value.id);
  const configuredDisplayUnit = chartStore.compareConfigs[id]?.displayUnit ?? null;
  const available = getAvailableDisplayUnits(primaryBaseUnitLabel.value);

  if (!available.length) return "";
  if (available.includes(configuredDisplayUnit)) return configuredDisplayUnit;

  return primaryBaseUnitLabel.value;
});

const showPrimaryDisplayUnitFilter = computed(() => {
  return (
    !!primaryDataset.value &&
    primaryMeasure.value === "nilai" &&
    primaryDisplayUnitOptions.value.length > 1
  );
});

const onPrimaryDisplayUnitChange = (displayUnit) => {
  if (!primaryDataset.value) return;
  chartStore.setDisplayUnit(primaryDataset.value.id, displayUnit);
};

const staticBaseUnitLabel = computed(() => {
  if (!activeStaticDataset.value) return "";
  return getDatasetUnitLabel(activeStaticDataset.value, staticMeasure.value || "nilai");
});

const staticDisplayUnitOptions = computed(() => {
  const available = getAvailableDisplayUnits(staticBaseUnitLabel.value);

  if (staticMeasure.value !== "nilai") {
    return [];
  }

  return available.length > 1
    ? available.map((unit) => ({
        value: unit,
        label: unit,
      }))
    : [];
});

const effectiveStaticDisplayUnit = computed(() => {
  if (staticMeasure.value !== "nilai") return staticBaseUnitLabel.value;

  const available = getAvailableDisplayUnits(staticBaseUnitLabel.value);

  if (!available.length) return staticBaseUnitLabel.value;
  if (staticDisplayUnit.value && available.includes(staticDisplayUnit.value)) {
    return staticDisplayUnit.value;
  }

  return staticBaseUnitLabel.value;
});

const showStaticDisplayUnitFilter = computed(() => {
  return (
    !!activeStaticDataset.value &&
    staticMeasure.value === "nilai" &&
    staticDisplayUnitOptions.value.length > 1
  );
});

const onStaticDisplayUnitChange = (displayUnit) => {
  staticDisplayUnit.value = displayUnit;
};

function getDisplayUnitForDataset(dataset, measure = "nilai") {
  const baseUnit = getDatasetUnitLabel(dataset, measure);

  if (measure !== "nilai") return baseUnit;

  const id = String(dataset?.id ?? "");
  if (!id) return baseUnit;

  const available = getAvailableDisplayUnits(baseUnit);
  if (!available.length) return baseUnit;

  const configuredDisplayUnit = chartStore.compareConfigs[id]?.displayUnit ?? null;

  return available.includes(configuredDisplayUnit)
    ? configuredDisplayUnit
    : baseUnit;
}

function getLegendLabelWithUnit(dataset, measure = "nilai") {
  const name = getDatasetDisplayName(dataset);
  const unit = getDisplayUnitForDataset(dataset, measure);
  return unit ? `${name} (${unit})` : name;
}

function getStaticLegendLabelWithUnit(dataset, measure = "nilai") {
  const name = getDatasetDisplayName(dataset);

  if (measure !== "nilai") {
    const unit = getDatasetUnitLabel(dataset, measure);
    return unit ? `${name} (${unit})` : name;
  }

  const unit = effectiveStaticDisplayUnit.value || getDatasetUnitLabel(dataset, measure);
  return unit ? `${name} (${unit})` : name;
}

function getConvertedMetaForDataset(dataset, measure, meta) {
  const baseUnit = getDatasetUnitLabel(dataset, measure);

  if (measure !== "nilai") return meta;

  const displayUnit = getDisplayUnitForDataset(dataset, measure);

  return convertSeriesMetaByUnit(meta, baseUnit, displayUnit);
}

function getConvertedStaticMeta(meta, measure) {
  const baseUnit =
    activeStaticDataset.value
      ? getDatasetUnitLabel(activeStaticDataset.value, measure)
      : "";

  if (measure !== "nilai") return meta;

  const available = getAvailableDisplayUnits(baseUnit);
  const targetUnit = available.includes(effectiveStaticDisplayUnit.value)
    ? effectiveStaticDisplayUnit.value
    : baseUnit;

  return convertSeriesMetaByUnit(meta, baseUnit, targetUnit);
}

function handleSaveSlot(slot) {
  if (!primaryDataset.value) return;
  if (!canSaveCurrentIndicator.value) return;

  const alreadySaved = chartStore.hasSavedSlot(primaryDataset.value.id, slot);

  chartStore.saveIndicatorState(primaryDataset.value.id, {
    slot,
    customName: presetNameDrafts.value[slot],
    uiState: {
      selectedRange: selectedRange.value,
      selectedProvince: selectedProvince.value,
      dynamicChartType: dynamicChartType.value,
      combineBarMode: combineBarMode.value,
    },
    staticState: {
      staticComponent: staticComponent.value,
      staticMeasure: staticMeasure.value,
      staticPeriod: staticPeriod.value,
      staticMethod: staticMethod.value,
      staticChartType: staticChartType.value,
      staticDisplayUnit: staticDisplayUnit.value,
    },
  });

  presetNameDrafts.value[slot] = getSlotCustomName(slot);

  showPresetMessage(
    alreadySaved
      ? `Preset ${slot} berhasil diperbarui`
      : `Preset ${slot} berhasil disimpan`,
    "success"
  );
}

async function handleLoadSlot(slot) {
  if (!primaryDataset.value) return;
  if (!canSaveCurrentIndicator.value) return;

  const saved = chartStore.loadIndicatorState(primaryDataset.value.id, slot);
  if (!saved) return;

  const nextDynamicConfig = saved?.dynamicConfig ?? {};
  const nextUiState = saved?.uiState ?? {};
  const nextStaticState = saved?.staticState ?? {};

  chartStore.applyConfig(primaryDataset.value.id, nextDynamicConfig);

  selectedRange.value = nextUiState?.selectedRange ?? selectedRange.value;
  selectedProvince.value = nextUiState?.selectedProvince ?? selectedProvince.value;
  dynamicChartType.value = nextUiState?.dynamicChartType ?? dynamicChartType.value;
  combineBarMode.value = nextUiState?.combineBarMode ?? combineBarMode.value;

  staticComponent.value = nextStaticState?.staticComponent ?? "";
  staticMeasure.value = nextStaticState?.staticMeasure ?? "pertumbuhan";
  staticPeriod.value = nextStaticState?.staticPeriod ?? "";
  staticMethod.value = nextStaticState?.staticMethod ?? "";
  staticChartType.value = nextStaticState?.staticChartType ?? "line";
  staticDisplayUnit.value = nextStaticState?.staticDisplayUnit ?? "";

  showPresetMessage(`Preset ${slot} berhasil dimuat`, "success");
  closePresetPopover();
  await nextTick();
}

const activeMonthlyMethod = computed(() => {
  if (primaryMeasure.value !== "pertumbuhan" || primaryAggregation.value !== "monthly") return "";
  return primaryMethod.value ?? "";
});

const isBarVsBarMerge = computed(() =>
  isGabung.value &&
  dynamicChartType.value === "bar" &&
  staticChartType.value === "bar"
);

const isDualBarMerge = computed(() =>
  isGabung.value &&
  dynamicChartType.value === "bar" &&
  staticChartType.value === "bar"
);

const showCombineBarModeFilter = computed(() => isBarVsBarMerge.value);
const showDynamicChartTypeFilter = computed(() => !isGabung.value);
const showStaticChartTypeFilter = computed(() => !isGabung.value);

const canUsePeriodStackMerge = computed(() =>
  isDualBarMerge.value &&
  primaryMeasure.value === "nilai" &&
  staticMeasure.value === "nilai" &&
  !!primaryAggregation.value &&
  !!staticPeriod.value &&
  !hasIncompatibleLeftSeries.value &&
  (
    (primaryAggregation.value === "monthly" && staticPeriod.value === "quarterly") ||
    (primaryAggregation.value === "monthly" && staticPeriod.value === "yearly") ||
    (primaryAggregation.value === "quarterly" && staticPeriod.value === "yearly")
  )
);

const showStackBarFilter = computed(() =>
  isGabung.value &&
  isDualBarMerge.value &&
  (
    (primaryAggregation.value === "monthly" && staticPeriod.value === "quarterly") ||
    (primaryAggregation.value === "monthly" && staticPeriod.value === "yearly") ||
    (primaryAggregation.value === "quarterly" && staticPeriod.value === "yearly") ||
    (primaryAggregation.value === "yearly" && staticPeriod.value === "yearly")
  )
);

const useStackPeriodMerge = computed(() =>
  canUsePeriodStackMerge.value && combineBarMode.value === "stack"
);

const shouldStackQuarterly = computed(() =>
  !useStackPeriodMerge.value &&
  isGabung.value &&
  dynamicChartType.value === "bar" &&
  staticChartType.value === "bar" &&
  combineBarMode.value === "stack" &&
  staticPeriod.value === "quarterly" &&
  primaryAggregation.value === "quarterly" &&
  primaryMeasure.value === "nilai" &&
  staticMeasure.value === "nilai"
);

const shouldStackYearly = computed(() =>
  !useStackPeriodMerge.value &&
  isGabung.value &&
  dynamicChartType.value === "bar" &&
  staticChartType.value === "bar" &&
  combineBarMode.value === "stack" &&
  staticPeriod.value === "yearly" &&
  primaryAggregation.value === "yearly" &&
  primaryMeasure.value === "nilai" &&
  staticMeasure.value === "nilai"
);

const chartDataLBridge = ref({
  labels: [],
  datasets: [],
});

const {
  theme,
  hasStaticNilaiQuarterly,
  hasStaticNilaiYearly,
  hasStaticGrowthQuarterly,
  hasStaticGrowthYearly,
  staticSeriesMeta,
  activeLeftSeries,
  hasMixedMeasureKindsLeft,
  activeDatasetOrderMap,
  hasIncompatibleLeftSeries,
  chartOptionsL,
  chartOptionsR,
} = useChartLogic({
  chartStore,
  isGabung,
  primaryDataset,
  primaryMeasure,
  primaryAggregation,
  staticMeasure,
  staticPeriod,
  staticMethod,
  activeStaticDataset,
  selectedRange,
  dynamicChartType,
  staticChartType,
  chartDataL: chartDataLBridge,
  useStackPeriodMerge,
  shouldStackQuarterly,
  shouldStackYearly,
  activeMonthlyMethod,
  getDatasetUnitLabel,
  primaryDisplayUnit,
  staticDisplayUnit: effectiveStaticDisplayUnit,
});

watch(
  () => [
    isGabung.value,
    dynamicChartType.value,
    staticChartType.value,
    primaryAggregation.value,
    staticPeriod.value,
    primaryMeasure.value,
    staticMeasure.value,
    hasIncompatibleLeftSeries.value,
  ],
  ([
    merged,
    leftType,
    rightType,
    leftAggregation,
    rightAggregation,
    leftMeasure,
    rightMeasure,
    hasIncompatible,
  ]) => {
    if (!merged) {
      combineBarMode.value = "standard";
      return;
    }

    if (hasIncompatible) {
      combineBarMode.value = "standard";
      return;
    }

    if (
      leftType === "bar" &&
      rightType === "bar" &&
      leftMeasure === "nilai" &&
      rightMeasure === "nilai" &&
      (
        (leftAggregation === "monthly" && rightAggregation === "quarterly") ||
        (leftAggregation === "monthly" && rightAggregation === "yearly") ||
        (leftAggregation === "quarterly" && rightAggregation === "yearly") ||
        (leftAggregation === "yearly" && rightAggregation === "yearly")
      )
    ) {
      combineBarMode.value = "stack";
      return;
    }

    combineBarMode.value = "standard";
  },
  { immediate: true }
);

watch(
  [hasStaticNilaiQuarterly, hasStaticNilaiYearly, hasStaticGrowthQuarterly, hasStaticGrowthYearly],
  ([qNilai, yNilai, qGrowth, yGrowth]) => {
    hasStaticNilaiQuarterlyBridge.value = qNilai;
    hasStaticNilaiYearlyBridge.value = yNilai;
    hasStaticGrowthQuarterlyBridge.value = qGrowth;
    hasStaticGrowthYearlyBridge.value = yGrowth;
  },
  { immediate: true }
);

const isLeftUiReady = computed(() => {
  if (!activeMappedSource.value) return true;
  if (!cards.value.length) return false;
  if (!primaryDataset.value) return false;
  if (!primaryMeasure.value) return false;
  if (!primaryAggregation.value) return false;

  if (
    primaryMeasure.value === "pertumbuhan" &&
    primaryAggregation.value !== "yearly" &&
    !primaryMethod.value
  ) {
    return false;
  }

  return true;
});

const isRightUiReady = computed(() => {
  if (!staticComponent.value) return true;
  if (!activeStaticDataset.value) return false;
  if (!staticMeasure.value) return false;
  if (!staticPeriod.value) return false;

  if (
    staticMeasure.value === "pertumbuhan" &&
    staticPeriod.value === "quarterly" &&
    !staticMethod.value
  ) {
    return false;
  }

  return true;
});

const areVisibleChartsRendered = () => {
  const leftReady = !leftPanelRef.value || !!leftPanelRef.value.querySelector("canvas");
  const rightReady =
    isGabung.value || !rightPanelRef.value || !!rightPanelRef.value.querySelector("canvas");

  return leftReady && rightReady;
};

const isPageContentReady = computed(() => {
  return !isLoadingCards.value && isLeftUiReady.value && isRightUiReady.value;
});

const settleUiRender = async () => {
  await nextTick();
  await nextTick();
  await wait(150);
};

const withPageBusy = async (fn) => {
  isPageBusy.value = true;
  startLoadingStageAnimation();

  try {
    const result = await fn();

    loadingStageText.value = "Menyelesaikan render...";
    loadingProgressText.value = "Menunggu semua card dan chart tampil sempurna";
    loadingPulseKey.value += 1;

    await settleUiRender();
    await waitUntil(
      () => isPageContentReady.value && areVisibleChartsRendered(),
      15000,
      60
    );
    await settleUiRender();
    await wait(280);

    await finishLoadingStageAnimation();
    await wait(220);

    return result;
  } finally {
    stopLoadingStageAnimation();
    isPageBusy.value = false;
  }
};

watch(
  [
    isGabung,
    primaryMeasure,
    primaryAggregation,
    staticComponent,
    staticPeriod,
    canChoosePrimaryMonthly,
    canChoosePrimaryQuarterly,
    canChoosePrimaryYearly,
    isPrimaryMonthlyDisabled,
    isPrimaryQuarterlyDisabled,
    isPrimaryYearlyDisabled,
    isStaticQuarterlyDisabled,
    isStaticYearlyDisabled,
  ],
  () => {
    if (!isGabung.value) return;
    if (!primaryDataset.value) return;

    if (primaryAggregation.value === "monthly" && isPrimaryMonthlyDisabled.value) {
      if (!isPrimaryQuarterlyDisabled.value && canChoosePrimaryQuarterly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "quarterly");
        return;
      }
      if (!isPrimaryYearlyDisabled.value && canChoosePrimaryYearly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "yearly");
      }
    }

    if (primaryAggregation.value === "quarterly" && isPrimaryQuarterlyDisabled.value) {
      if (!isPrimaryMonthlyDisabled.value && canChoosePrimaryMonthly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "monthly");
        return;
      }
      if (!isPrimaryYearlyDisabled.value && canChoosePrimaryYearly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "yearly");
      }
    }

    if (primaryAggregation.value === "yearly" && isPrimaryYearlyDisabled.value) {
      if (!isPrimaryQuarterlyDisabled.value && canChoosePrimaryQuarterly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "quarterly");
        return;
      }
      if (!isPrimaryMonthlyDisabled.value && canChoosePrimaryMonthly.value) {
        chartStore.setAggregation(primaryDataset.value.id, "monthly");
      }
    }

    if (staticPeriod.value === "quarterly" && isStaticQuarterlyDisabled.value) {
      if (!isStaticYearlyDisabled.value) {
        staticPeriod.value = "yearly";
      }
    }

    if (staticPeriod.value === "yearly" && isStaticYearlyDisabled.value) {
      if (!isStaticQuarterlyDisabled.value) {
        staticPeriod.value = "quarterly";
      }
    }
  }
);

watch(
  [primaryMeasure, primaryBaseUnitLabel, primaryDataset],
  ([measure, baseUnit, dataset]) => {
    if (!dataset) return;

    const available = getAvailableDisplayUnits(baseUnit);

    if (measure !== "nilai" || !available.length) {
      chartStore.setDisplayUnit(dataset.id, null);
      return;
    }

    const id = String(dataset.id);
    const currentDisplayUnit = chartStore.compareConfigs[id]?.displayUnit ?? null;

    if (currentDisplayUnit && available.includes(currentDisplayUnit)) {
      return;
    }

    chartStore.setDisplayUnit(dataset.id, baseUnit);
  },
  { immediate: true }
);

watch(
  [staticMeasure, staticBaseUnitLabel, activeStaticDataset],
  ([measure, baseUnit, dataset]) => {
    if (!dataset) {
      staticDisplayUnit.value = "";
      return;
    }

    const available = getAvailableDisplayUnits(baseUnit);

    if (measure !== "nilai" || available.length <= 1) {
      staticDisplayUnit.value = "";
      return;
    }

    if (staticDisplayUnit.value && available.includes(staticDisplayUnit.value)) {
      return;
    }

    staticDisplayUnit.value = baseUnit;
  },
  { immediate: true }
);

function buildMonthlyQuarterlyMergeDatasets(leftSeries, staticDataset) {
  const quarterlyMeta = getSeriesMeta(staticDataset, "quarterly");
  const trimmedQuarterlyMeta = trimMetaByRange(quarterlyMeta, selectedRange.value);

  const convertedQuarterlyMeta = getConvertedStaticMeta(
    trimmedQuarterlyMeta,
    staticMeasure.value
  );

  const quarterPeriods = convertedQuarterlyMeta.periods ?? [];
  const quarterTotals = convertedQuarterlyMeta.data ?? [];

  if (!leftSeries.length || !quarterPeriods.length) {
    return { labels: [], datasets: [] };
  }

  const labels = [];
  const datasets = [];
  const monthSlots = [1, 2, 3];
  const monthNamesShort = ["Jan", "Feb", "Mar"];

  quarterPeriods.forEach((qPeriod) => {
    leftSeries.forEach((seriesItem) => {
      labels.push(`${qPeriod}__detail__${seriesItem.dataset.id}`);
    });
    labels.push(`${qPeriod}__total`);
  });

  leftSeries.forEach((seriesItem, seriesIdx) => {
    const displayMeta = getConvertedMetaForDataset(
      seriesItem.dataset,
      seriesItem.measure,
      seriesItem.meta
    );

    const monthlyPeriods = displayMeta.periods ?? [];
    const monthlyValues = displayMeta.data ?? [];
    const datasetId = String(seriesItem.dataset.id);

    const monthlySlotMap = {
      1: labels.map((x) => ({ x, y: null })),
      2: labels.map((x) => ({ x, y: null })),
      3: labels.map((x) => ({ x, y: null })),
    };

    quarterPeriods.forEach((qPeriod) => {
      const q = parsePeriod(qPeriod);
      const targetKey = `${qPeriod}__detail__${datasetId}`;
      const targetIndex = labels.indexOf(targetKey);

      if (targetIndex === -1) return;

      monthlyPeriods.forEach((mPeriod, mIndex) => {
        const m = parsePeriod(mPeriod);
        if (
          m.type === "monthly" &&
          q.type === "quarterly" &&
          m.year === q.year &&
          m.quarter === q.quarter
        ) {
          const monthInQuarter = ((m.month - 1) % 3) + 1;
          monthlySlotMap[monthInQuarter][targetIndex] = {
            x: targetKey,
            y: monthlyValues[mIndex] ?? null,
          };
        }
      });
    });

    monthSlots.forEach((slot, idx) => {
      const stackColor = getDatasetStackColor({
        datasetId,
        slot,
        mode: "month",
        datasetOrderMap: activeDatasetOrderMap.value,
      });

      datasets.push({
        label: `${getDatasetDisplayName(seriesItem.dataset)} - ${monthNamesShort[idx]}`,
        data: monthlySlotMap[slot],
        tooltipPeriods: labels,
        sourceAggregation: "monthly",
        ...buildDatasetStyle({
          chartType: "bar",
          lineColor: stackColor.line,
          fillColor: stackColor.fill,
          yAxisID: "y",
          xAxisID: "xQuarterlyMerge",
          isStatic: false,
          grouped: false,
          maxBarThickness: 56,
          categoryPercentage: 0.95,
          barPercentage: 0.98,
        }),
        stack: `${datasetId}-detail`,
        order: 10 + seriesIdx,
      });
    });
  });

  const totalBars = labels.map((x) => ({ x, y: null }));

  quarterPeriods.forEach((qPeriod, qIndex) => {
    const totalKey = `${qPeriod}__total`;
    const targetIndex = labels.indexOf(totalKey);

    if (targetIndex !== -1) {
      totalBars[targetIndex] = {
        x: totalKey,
        y: quarterTotals[qIndex] ?? null,
      };
    }
  });

  datasets.push({
    label: `${getStaticLegendLabelWithUnit(staticDataset, staticMeasure.value)} - Total Triwulan`,
    data: totalBars,
    tooltipPeriods: labels,
    sourceAggregation: "quarterly",
    ...buildDatasetStyle({
      chartType: "bar",
      lineColor: TOTAL_BAR_COLOR.line,
      fillColor: TOTAL_BAR_COLOR.fill,
      yAxisID: "y1",
      xAxisID: "xQuarterlyMerge",
      isStatic: true,
      grouped: false,
      maxBarThickness: 56,
      categoryPercentage: 0.95,
      barPercentage: 0.98,
    }),
    stack: "grand-total",
    order: 999,
  });

  return { labels, datasets };
}

function buildMonthlyYearlyMergeDatasets(leftSeries, staticDataset) {
  const yearlyMeta = getSeriesMeta(staticDataset, "yearly");
  const trimmedYearlyMeta = trimMetaByRange(yearlyMeta, selectedRange.value);

  const convertedYearlyMeta = getConvertedStaticMeta(
    trimmedYearlyMeta,
    staticMeasure.value
  );

  const yearPeriods = (convertedYearlyMeta.periods ?? []).map(normalizeYearLikePeriod);
  const yearTotals = convertedYearlyMeta.data ?? [];

  if (!leftSeries.length || !yearPeriods.length) {
    return { labels: [], datasets: [] };
  }

  const labels = [];
  const datasets = [];
  const monthSlots = Array.from({ length: 12 }, (_, i) => i + 1);

  yearPeriods.forEach((yPeriod) => {
    leftSeries.forEach((seriesItem) => {
      labels.push(`${yPeriod}__detail__${seriesItem.dataset.id}`);
    });
    labels.push(`${yPeriod}__total`);
  });

  leftSeries.forEach((seriesItem, seriesIdx) => {
    const displayMeta = getConvertedMetaForDataset(
      seriesItem.dataset,
      seriesItem.measure,
      seriesItem.meta
    );

    const monthlyPeriods = displayMeta.periods ?? [];
    const monthlyValues = displayMeta.data ?? [];
    const datasetId = String(seriesItem.dataset.id);

    const monthlySlotMap = Object.fromEntries(
      monthSlots.map((slot) => [slot, labels.map((x) => ({ x, y: null }))])
    );

    yearPeriods.forEach((yPeriod) => {
      const y = parsePeriod(yPeriod);
      const targetKey = `${yPeriod}__detail__${datasetId}`;
      const targetIndex = labels.indexOf(targetKey);

      if (targetIndex === -1) return;

      monthlyPeriods.forEach((mPeriod, mIndex) => {
        const m = parsePeriod(mPeriod);
        if (
          m.type === "monthly" &&
          y.type === "yearly" &&
          m.year === y.year
        ) {
          monthlySlotMap[m.month][targetIndex] = {
            x: targetKey,
            y: monthlyValues[mIndex] ?? null,
          };
        }
      });
    });

    monthSlots.forEach((slot) => {
      const stackColor = getDatasetStackColor({
        datasetId,
        slot,
        mode: "month",
        datasetOrderMap: activeDatasetOrderMap.value,
      });

      datasets.push({
        label: `${getDatasetDisplayName(seriesItem.dataset)} - ${
          ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][slot - 1]
        }`,
        data: monthlySlotMap[slot],
        tooltipPeriods: labels,
        sourceAggregation: "monthly",
        ...buildDatasetStyle({
          chartType: "bar",
          lineColor: stackColor.line,
          fillColor: stackColor.fill,
          yAxisID: "y",
          xAxisID: "xYearlyMerge",
          isStatic: false,
          grouped: false,
          maxBarThickness: 56,
          categoryPercentage: 0.95,
          barPercentage: 0.98,
        }),
        stack: `${datasetId}-detail`,
        order: 10 + seriesIdx,
      });
    });
  });

  const totalBars = labels.map((x) => ({ x, y: null }));

  yearPeriods.forEach((yPeriod, yIndex) => {
    const totalKey = `${yPeriod}__total`;
    const targetIndex = labels.indexOf(totalKey);

    if (targetIndex !== -1) {
      totalBars[targetIndex] = {
        x: totalKey,
        y: yearTotals[yIndex] ?? null,
      };
    }
  });

  datasets.push({
    label: `${getStaticLegendLabelWithUnit(staticDataset, staticMeasure.value)} - Total Tahunan`,
    data: totalBars,
    tooltipPeriods: labels,
    sourceAggregation: "yearly",
    ...buildDatasetStyle({
      chartType: "bar",
      lineColor: TOTAL_BAR_COLOR.line,
      fillColor: TOTAL_BAR_COLOR.fill,
      yAxisID: "y1",
      xAxisID: "xYearlyMerge",
      isStatic: true,
      grouped: false,
      maxBarThickness: 56,
      categoryPercentage: 0.95,
      barPercentage: 0.98,
    }),
    stack: "grand-total",
    order: 999,
  });

  return { labels, datasets };
}

function buildQuarterlyYearlyMergeDatasets(leftSeries, yearlyDataset) {
  const yearlyMeta = getSeriesMeta(yearlyDataset, "yearly");
  const trimmedYearlyMeta = trimMetaByRange(yearlyMeta, selectedRange.value);

  const convertedYearlyMeta = getConvertedStaticMeta(
    trimmedYearlyMeta,
    staticMeasure.value
  );

  const yearPeriods = (convertedYearlyMeta.periods ?? []).map(normalizeYearLikePeriod);
  const yearTotals = convertedYearlyMeta.data ?? [];

  if (!leftSeries.length || !yearPeriods.length) {
    return { labels: [], datasets: [] };
  }

  const labels = [];
  const datasets = [];
  const quarterSlots = [1, 2, 3, 4];

  yearPeriods.forEach((yPeriod) => {
    leftSeries.forEach((seriesItem) => {
      labels.push(`${yPeriod}__detail__${seriesItem.dataset.id}`);
    });
    labels.push(`${yPeriod}__total`);
  });

  leftSeries.forEach((seriesItem, seriesIdx) => {
    const displayMeta = getConvertedMetaForDataset(
      seriesItem.dataset,
      seriesItem.measure,
      seriesItem.meta
    );

    const quarterPeriods = displayMeta.periods ?? [];
    const quarterValues = displayMeta.data ?? [];
    const datasetId = String(seriesItem.dataset.id);

    const quarterSlotMap = {
      1: labels.map((x) => ({ x, y: null })),
      2: labels.map((x) => ({ x, y: null })),
      3: labels.map((x) => ({ x, y: null })),
      4: labels.map((x) => ({ x, y: null })),
    };

    yearPeriods.forEach((yPeriod) => {
      const y = parsePeriod(yPeriod);
      const targetKey = `${yPeriod}__detail__${datasetId}`;
      const targetIndex = labels.indexOf(targetKey);

      if (targetIndex === -1) return;

      quarterPeriods.forEach((qPeriod, qIndex) => {
        const q = parsePeriod(qPeriod);
        if (
          q.type === "quarterly" &&
          y.type === "yearly" &&
          q.year === y.year
        ) {
          quarterSlotMap[q.quarter][targetIndex] = {
            x: targetKey,
            y: quarterValues[qIndex] ?? null,
          };
        }
      });
    });

    quarterSlots.forEach((slot) => {
      const stackColor = getDatasetStackColor({
        datasetId,
        slot,
        mode: "quarter",
        datasetOrderMap: activeDatasetOrderMap.value,
      });

      datasets.push({
        label: `${getDatasetDisplayName(seriesItem.dataset)} - Q${slot}`,
        data: quarterSlotMap[slot],
        tooltipPeriods: labels,
        sourceAggregation: "quarterly",
        ...buildDatasetStyle({
          chartType: "bar",
          lineColor: stackColor.line,
          fillColor: stackColor.fill,
          yAxisID: "y",
          xAxisID: "xYearlyMerge",
          isStatic: false,
          grouped: false,
          maxBarThickness: 56,
          categoryPercentage: 0.95,
          barPercentage: 0.98,
        }),
        stack: `${datasetId}-detail`,
        order: 10 + seriesIdx,
      });
    });
  });

  const totalBars = labels.map((x) => ({ x, y: null }));

  yearPeriods.forEach((yPeriod, yIndex) => {
    const totalKey = `${yPeriod}__total`;
    const targetIndex = labels.indexOf(totalKey);

    if (targetIndex !== -1) {
      totalBars[targetIndex] = {
        x: totalKey,
        y: yearTotals[yIndex] ?? null,
      };
    }
  });

  datasets.push({
    label: `${getStaticLegendLabelWithUnit(yearlyDataset, staticMeasure.value)} - Total Tahunan`,
    data: totalBars,
    tooltipPeriods: labels,
    sourceAggregation: "yearly",
    ...buildDatasetStyle({
      chartType: "bar",
      lineColor: TOTAL_BAR_COLOR.line,
      fillColor: TOTAL_BAR_COLOR.fill,
      yAxisID: "y1",
      xAxisID: "xYearlyMerge",
      isStatic: true,
      grouped: false,
      maxBarThickness: 56,
      categoryPercentage: 0.95,
      barPercentage: 0.98,
    }),
    stack: "grand-total",
    order: 999,
  });

  return { labels, datasets };
}

const chartDataL = computed(() => {
  const staticDs = activeStaticDataset.value;
  const leftSeries = activeLeftSeries.value;

  if (
    isGabung.value &&
    staticDs &&
    useStackPeriodMerge.value &&
    leftSeries.length
  ) {
    if (primaryAggregation.value === "monthly" && staticPeriod.value === "quarterly") {
      const merged = buildMonthlyQuarterlyMergeDatasets(leftSeries, staticDs);
      return {
        labels: merged.labels,
        datasets: merged.datasets,
      };
    }

    if (primaryAggregation.value === "monthly" && staticPeriod.value === "yearly") {
      const merged = buildMonthlyYearlyMergeDatasets(leftSeries, staticDs);
      return {
        labels: merged.labels,
        datasets: merged.datasets,
      };
    }

    if (primaryAggregation.value === "quarterly" && staticPeriod.value === "yearly") {
      const merged = buildQuarterlyYearlyMergeDatasets(leftSeries, staticDs);
      return {
        labels: merged.labels,
        datasets: merged.datasets,
      };
    }
  }

  const dyn = activeLeftSeries.value.map((item) => {
    const displayMeta = getConvertedMetaForDataset(
      item.dataset,
      item.measure,
      item.meta
    );

    const tooltipMeta = createDatasetTooltipMeta({
      periods: displayMeta.periods,
      sourceAggregation: item.aggregation,
    });

    const yAxisID = hasMixedMeasureKindsLeft.value
      ? (item.measure === "pertumbuhan" ? "y1" : "y")
      : "y";

    return {
      label: getLegendLabelWithUnit(item.dataset, item.measure),
      data: toPointData(displayMeta),
      ...tooltipMeta,
      ...buildDatasetStyle({
        chartType: dynamicChartType.value,
        lineColor: item.colors.line,
        fillColor: item.colors.fill,
        yAxisID,
        xAxisID: aggregationToAxisId(item.aggregation),
        isStatic: false,
      }),
    };
  });

  if (isGabung.value && staticDs && staticPeriod.value) {
    const staticAggregation = staticPeriod.value === "yearly" ? "yearly" : "quarterly";
    const convertedStaticMeta = getConvertedStaticMeta(
      staticSeriesMeta.value,
      staticMeasure.value
    );

    const staticYAxisID = hasMixedMeasureKindsLeft.value
      ? (staticMeasure.value === "pertumbuhan" ? "y1" : "y")
      : "y";

    dyn.push({
      label: getStaticLegendLabelWithUnit(staticDs, staticMeasure.value),
      data: toPointData(convertedStaticMeta),
      ...createDatasetTooltipMeta({
        periods: convertedStaticMeta.periods,
        sourceAggregation: staticAggregation,
      }),
      ...buildDatasetStyle({
        chartType: staticChartType.value,
        lineColor: theme.value.primary || "#10B981",
        fillColor: "rgba(16, 185, 129, 0.45)",
        yAxisID: staticYAxisID,
        xAxisID: aggregationToAxisId(staticAggregation),
        isStatic: true,
      }),
    });
  }

  return {
    labels: [],
    datasets: dyn,
  };
});

watch(
  chartDataL,
  (val) => {
    chartDataLBridge.value = val;
  },
  { immediate: true, deep: true }
);

const rightAxisId = computed(() =>
  staticPeriod.value === "yearly" ? "xYearly" : "xQuarterly"
);

const chartDataR = computed(() => {
  const convertedStaticMeta = getConvertedStaticMeta(
    staticSeriesMeta.value,
    staticMeasure.value
  );

  return {
    labels: [],
    datasets:
      activeStaticDataset.value && staticPeriod.value
        ? [
            {
              ...activeStaticDataset.value,
              label: getStaticLegendLabelWithUnit(activeStaticDataset.value, staticMeasure.value),
              data: toPointData(convertedStaticMeta),
              ...createDatasetTooltipMeta({
                periods: convertedStaticMeta.periods,
                sourceAggregation: staticPeriod.value === "yearly" ? "yearly" : "quarterly",
              }),
              ...buildDatasetStyle({
                chartType: staticChartType.value,
                lineColor: theme.value.primary || "#10B981",
                fillColor: "rgba(16, 185, 129, 0.45)",
                yAxisID: "y",
                xAxisID: rightAxisId.value,
                isStatic: true,
              }),
            },
          ]
        : [],
  };
});

const valueLabelPlugin = {
  id: "valueLabelPlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset) return;
      if (dataset.isStatic !== true) return;
      if (String(dataset.type ?? "").toLowerCase() !== "line") return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden || !Array.isArray(meta.data)) return;

      meta.data.forEach((element, i) => {
        const point = dataset.data?.[i];
        const val =
          point && typeof point === "object"
            ? point.y
            : Array.isArray(dataset.data)
              ? dataset.data[i]
              : null;

        if (val === null || val === undefined || Number.isNaN(Number(val))) return;

        const x = element?.x;
        const y = element?.y;

        if (x === undefined || y === undefined) return;

        const label = formatChartNumber(val, {
          minFractionDigits: 0,
          maxFractionDigits: 2,
          fallback: "",
        });

        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.fillStyle = theme.value.text || "#E5E7EB";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, x, y - 8);
        ctx.restore();
      });
    });
  },
};

onMounted(async () => {
  document.addEventListener("click", handleDocumentClick);

  await withPageBusy(async () => {
    await loadPdbComponentOptions();
    const result = await reloadBySelectedComponent();
    staticPeriod.value = result.staticPeriod;
    staticMethod.value = result.staticMethod;
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
  clearPresetMessage();
});

watch(staticComponent, async (val, oldVal) => {
  if (!val) {
    staticPeriod.value = "";
    staticMethod.value = "";
    staticDisplayUnit.value = "";
    resetAllDataState();
    return;
  }

  if (val === oldVal) return;

  if (!staticPeriod.value) {
    staticPeriod.value = "quarterly";
  }

  await withPageBusy(async () => {
    const result = await reloadBySelectedComponent();
    staticPeriod.value = result.staticPeriod;
    staticMethod.value = result.staticMethod;
  });
});

watch(staticMeasure, async () => {
  await withPageBusy(async () => {
    if (staticPeriod.value === "quarterly") {
      staticMethod.value = "qtoq";
    } else if (staticPeriod.value === "yearly") {
      staticMethod.value = "annual";
    }

    if (staticMeasure.value !== "nilai") {
      staticDisplayUnit.value = "";
    }

    await loadActiveStaticDataset();
  });
});

watch(staticPeriod, (val) => {
  if (!val) {
    staticMethod.value = "";
    return;
  }

  if (val === "quarterly") {
    staticMethod.value = "qtoq";
    return;
  }

  if (val === "yearly") {
    staticMethod.value = "annual";
  }
});

watch(componentRuleMode, async () => {
  const filtered = filteredPdbIndicatorOptions.value;

  if (!filtered.length) {
    staticComponent.value = "";
    resetAllDataState();
    return;
  }

  const stillExists = filtered.some(
    (item) => String(item.kode) === String(staticComponent.value)
  );

  if (!stillExists) {
    staticComponent.value = String(filtered[0].kode);
  }
});

const leftChartKey = computed(() => {
  const datasetId = primaryDataset.value?.id ?? "no-dataset";
  const seriesSignature = activeLeftSeries.value
    .map((item) => {
      const displayUnit = getDisplayUnitForDataset(item.dataset, item.measure);

      return [
        item.dataset.id,
        item.aggregation,
        item.meta?.periods?.[0] ?? "",
        item.meta?.periods?.length ?? 0,
        item.measure ?? "",
        displayUnit ?? "",
      ].join(":");
    })
    .join(",");

  return [
    "left",
    datasetId,
    activeMappedSource.value ?? "",
    primaryMeasure.value ?? "",
    primaryAggregation.value ?? "",
    primaryMethod.value ?? "",
    primaryDisplayUnit.value ?? "",
    dynamicChartType.value ?? "",
    staticChartType.value ?? "",
    staticMeasure.value ?? "",
    staticPeriod.value ?? "",
    staticMethod.value ?? "",
    effectiveStaticDisplayUnit.value ?? "",
    combineBarMode.value ?? "",
    selectedRange.value ?? "",
    useStackPeriodMerge.value ? "stack-period" : "normal",
    isGabung.value ? "gabung" : "single",
    activeStaticDataset.value?.id ?? "no-static",
    staticSeriesMeta.value?.periods?.[0] ?? "",
    staticSeriesMeta.value?.periods?.length ?? 0,
    seriesSignature,
  ].join("|");
});

const rightChartKey = computed(() => {
  const datasetId = activeStaticDataset.value?.id ?? staticComponent.value ?? "no-static";
  return [
    "right",
    activeMappedSource.value ?? "",
    datasetId,
    staticMeasure.value ?? "",
    staticPeriod.value ?? "",
    staticMethod.value ?? "",
    staticChartType.value ?? "",
    effectiveStaticDisplayUnit.value ?? "",
    selectedRange.value ?? "",
    staticSeriesMeta.value?.periods?.[0] ?? "",
    staticSeriesMeta.value?.periods?.length ?? 0,
  ].join("|");
});
</script>

<template>
  <div class="relative flex h-screen w-screen overflow-hidden">
    <div
      v-if="isPageBusy"
      class="page-loading-overlay"
    >
      <div class="page-loading-card">
        <div class="page-loading-ring-wrap">
          <div class="page-loading-ring ring-back"></div>
          <div class="page-loading-ring ring-front"></div>
          <div class="page-loading-core"></div>
          <div class="page-loading-percent">
            {{ Math.round(loadingPercent) }}%
          </div>
        </div>

        <Transition name="loading-fade" mode="out-in">
          <h2
            :key="`title-${loadingPulseKey}`"
            class="page-loading-title"
          >
            {{ loadingStageText }}
          </h2>
        </Transition>

        <Transition name="loading-fade" mode="out-in">
          <p
            :key="`subtitle-${loadingPulseKey}`"
            class="page-loading-text"
          >
            {{ loadingProgressText }}
          </p>
        </Transition>

        <div class="page-loading-bar">
          <span
            class="page-loading-bar-fill"
            :style="{ width: `${Math.round(loadingPercent)}%` }"
          ></span>
          <span class="page-loading-bar-glow"></span>
        </div>

        <div class="page-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <div
      v-if="snapshotPiecesVisible"
      class="snapshot-piece-layer"
      aria-hidden="true"
    >
      <span
        v-for="piece in snapshotPieces"
        :key="piece.id"
        class="snapshot-piece"
        :style="piece.style"
      />
    </div>

    <div class="h-full w-[340px] max-w-[380px] min-w-[280px] shrink-0 overflow-y-auto overflow-x-hidden">
      <div class="flex flex-col gap-1">
        <CardComponent
          v-for="card in cards"
          :key="card.id"
          :datasets="card"
          :is-gabung="isGabung"
          :monthly-disabled="isCardMonthlyDisabled(card)"
          :quarterly-disabled="isCardQuarterlyDisabled(card)"
        />
      </div>
    </div>

    <div class="flex-8 h-full overflow-hidden">
      <div class="h-full overflow-auto p-4">
        <div class="global-top-toolbar mb-3 flex flex-wrap items-end justify-between gap-3">
          <div class="global-left-tools flex flex-wrap items-end gap-3">
            <div class="standalone-filter-box">
              <label class="standalone-filter-label">Wilayah</label>
              <select
                v-model="selectedProvince"
                class="standalone-filter-control"
                :disabled="isPageBusy"
              >
                <option
                  v-for="opt in provinceOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="standalone-filter-box">
              <label class="standalone-filter-label">Komponen</label>
              <select
                v-model="staticComponent"
                class="standalone-filter-control component-dropdown"
                :disabled="isPageBusy"
              >
                <option value="" disabled>Pilih komponen</option>
                <option
                  v-for="opt in globalComponentOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :title="opt.fullLabel"
                  :class="{ 'component-option-header': opt.isHeader }"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="global-right-tools flex flex-wrap items-center justify-end gap-2">
            <button
              v-for="item in rangeButtons"
              :key="item.value"
              type="button"
              class="range-chip"
              :class="{ active: selectedRange === item.value }"
              :disabled="isPageBusy"
              @click="selectedRange = item.value"
            >
              {{ item.label }}
            </button>

            <div
              ref="presetPopoverRef"
              class="preset-popover-wrap"
              :class="{ disabled: !canSaveCurrentIndicator }"
            >
              <button
                type="button"
                class="preset-trigger-btn"
                :disabled="!canSaveCurrentIndicator || isPageBusy"
                @click.stop="togglePresetPopover"
              >
                <span class="preset-trigger-label">Saved Views</span>
                <span class="preset-trigger-meta">
                  {{
                    hasSavedSlot1
                      ? getSlotCustomName(1)
                      : hasSavedSlot2
                        ? getSlotCustomName(2)
                        : "Belum ada preset"
                  }}
                </span>
              </button>

              <Transition name="preset-pop">
                <div
                  v-if="isPresetPopoverOpen"
                  class="preset-popover-panel"
                  @click.stop
                >
                  <div class="preset-popover-header">
                    <div>
                      <div class="preset-popover-title">Saved Views</div>
                      <div class="preset-popover-subtitle">Simpan kondisi dua chart</div>
                    </div>
                  </div>

                  <div
                    v-if="presetActionMessage"
                    class="preset-feedback"
                    :class="presetActionType"
                  >
                    {{ presetActionMessage }}
                  </div>

                  <div class="preset-popover-list">
                    <div class="preset-popover-item">
                      <div class="preset-popover-item-top">
                        <div class="preset-popover-item-meta">
                          <span class="preset-popover-item-title">{{ getSlotCustomName(1) }}</span>
                          <span
                            v-if="slot1SavedAtText"
                            class="preset-popover-item-time"
                          >
                            {{ slot1SavedAtText }}
                          </span>
                        </div>

                        <span class="preset-slot-state" :class="{ filled: hasSavedSlot1 }">
                          {{ getSlotStatusLabel(hasSavedSlot1) }}
                        </span>
                      </div>

                      <div class="preset-name-editor">
                        <input
                          v-model="presetNameDrafts[1]"
                          type="text"
                          class="preset-name-input"
                          placeholder="Nama preset 1"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @focus="openRenameDraft(1)"
                        />
                        <button
                          v-if="hasSavedSlot1"
                          type="button"
                          class="preset-rename-btn"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @click="handleRenameSlot(1)"
                        >
                          Rename
                        </button>
                      </div>

                      <div class="preset-slot-actions">
                        <button
                          v-if="!hasSavedSlot1"
                          type="button"
                          class="preset-btn save single"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @click="handleSaveSlot(1)"
                        >
                          Save
                        </button>

                        <template v-else>
                          <button
                            type="button"
                            class="preset-btn load"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleLoadSlot(1)"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            class="preset-btn save"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleSaveSlot(1)"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            class="preset-btn clear"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleClearSlot(1)"
                          >
                            Clear
                          </button>
                        </template>
                      </div>
                    </div>

                    <div class="preset-popover-item">
                      <div class="preset-popover-item-top">
                        <div class="preset-popover-item-meta">
                          <span class="preset-popover-item-title">{{ getSlotCustomName(2) }}</span>
                          <span
                            v-if="slot2SavedAtText"
                            class="preset-popover-item-time"
                          >
                            {{ slot2SavedAtText }}
                          </span>
                        </div>

                        <span class="preset-slot-state" :class="{ filled: hasSavedSlot2 }">
                          {{ getSlotStatusLabel(hasSavedSlot2) }}
                        </span>
                      </div>

                      <div class="preset-name-editor">
                        <input
                          v-model="presetNameDrafts[2]"
                          type="text"
                          class="preset-name-input"
                          placeholder="Nama preset 2"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @focus="openRenameDraft(2)"
                        />
                        <button
                          v-if="hasSavedSlot2"
                          type="button"
                          class="preset-rename-btn"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @click="handleRenameSlot(2)"
                        >
                          Rename
                        </button>
                      </div>

                      <div class="preset-slot-actions">
                        <button
                          v-if="!hasSavedSlot2"
                          type="button"
                          class="preset-btn save single"
                          :disabled="!canSaveCurrentIndicator || isPageBusy"
                          @click="handleSaveSlot(2)"
                        >
                          Save
                        </button>

                        <template v-else>
                          <button
                            type="button"
                            class="preset-btn load"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleLoadSlot(2)"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            class="preset-btn save"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleSaveSlot(2)"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            class="preset-btn clear"
                            :disabled="!canSaveCurrentIndicator || isPageBusy"
                            @click="handleClearSlot(2)"
                          >
                            Clear
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <Button
              :label="isGabung ? 'Pisahkan' : 'Gabungkan'"
              :outlined="!isGabung"
              rounded
              :disabled="isCombineDisabled || isPageBusy"
              @click="onToggleGabung"
            />
          </div>
        </div>

        <p
          v-if="isCombineDisabled"
          class="mb-2 text-[12px] text-amber-400"
        >
          {{ combineDisabledMessage }}
        </p>

        <p class="preset-status-text mb-3">
          {{ saveStatusText }}
        </p>

        <div
          class="charts-shell mt-3 flex items-start gap-3"
          :class="{ merging: isMerging, merged: isGabung }"
        >
          <div
            v-if="isMerging"
            class="merge-fx-layer"
            :class="`phase-${mergePhase}`"
            aria-hidden="true"
          >
            <div class="merge-beam"></div>
            <div class="merge-shockwave"></div>
            <div class="merge-flash"></div>
          </div>

          <div
            ref="leftPanelRef"
            class="left-chart-panel min-w-0 flex-1"
            :class="{
              'merge-absorb': isMerging && mergePhase === 'absorb'
            }"
          >
            <LeftPanel
              :is-page-busy="isPageBusy"
              :show-primary-aggregation-filter="showPrimaryAggregationFilter"
              :show-primary-method-filter="showPrimaryMethodFilter"
              :show-dynamic-chart-type-filter="showDynamicChartTypeFilter"
              :show-stack-bar-filter="showStackBarFilter"
              :show-combine-bar-mode-filter="showCombineBarModeFilter"
              :show-primary-display-unit-filter="showPrimaryDisplayUnitFilter"
              :primary-measure="primaryMeasure"
              :primary-aggregation="primaryAggregation"
              :primary-method="primaryMethod"
              :primary-display-unit="primaryDisplayUnit"
              :primary-display-unit-options="primaryDisplayUnitOptions"
              :dynamic-chart-type="dynamicChartType"
              :combine-bar-mode="combineBarMode"
              :is-primary-monthly-disabled="isPrimaryMonthlyDisabled"
              :is-primary-quarterly-disabled="isPrimaryQuarterlyDisabled"
              :is-primary-yearly-disabled="isPrimaryYearlyDisabled"
              :filter-options="FILTER_OPTIONS"
              :left-chart-key="leftChartKey"
              :chart-data-l="chartDataL"
              :chart-options-l="chartOptionsL"
              :value-label-plugin="valueLabelPlugin"
              @primary-measure-change="onPrimaryMeasureChange"
              @primary-aggregation-change="onPrimaryAggregationChange"
              @primary-method-change="onPrimaryMethodChange"
              @update:primary-display-unit="onPrimaryDisplayUnitChange"
              @update:dynamic-chart-type="dynamicChartType = $event"
              @update:combine-bar-mode="combineBarMode = $event"
            />
          </div>

          <Transition name="merge-right-panel">
            <div
              v-if="!isGabung"
              ref="rightPanelRef"
              class="right-chart-panel min-w-0 basis-1/2 flex-1"
              :class="{
                'merge-lift': isMerging && mergePhase === 'lift',
                'merge-freeze': isMerging && mergePhase === 'freeze',
                'merge-transfer-out': isMerging && mergePhase === 'transfer'
              }"
            >
              <div
                v-if="isMerging && mergePhase === 'freeze'"
                class="freeze-frame-glow"
                aria-hidden="true"
              ></div>

              <RightPanel
                :is-page-busy="isPageBusy"
                :show-static-period-filter="showStaticPeriodFilter"
                :show-static-method-filter="showStaticMethodFilter"
                :show-static-chart-type-filter="showStaticChartTypeFilter"
                :show-static-display-unit-filter="showStaticDisplayUnitFilter"
                :static-component="staticComponent"
                :active-mapped-source="activeMappedSource"
                :static-measure="staticMeasure"
                :static-period="staticPeriod"
                :static-method="staticMethod"
                :static-chart-type="staticChartType"
                :static-display-unit="effectiveStaticDisplayUnit"
                :static-display-unit-options="staticDisplayUnitOptions"
                :is-static-quarterly-disabled="isStaticQuarterlyDisabled"
                :is-static-yearly-disabled="isStaticYearlyDisabled"
                :filter-options="FILTER_OPTIONS"
                :right-chart-key="rightChartKey"
                :chart-data-r="chartDataR"
                :chart-options-r="chartOptionsR"
                :value-label-plugin="valueLabelPlugin"
                @update:static-measure="staticMeasure = $event"
                @update:static-period="staticPeriod = $event"
                @update:static-method="staticMethod = $event"
                @update:static-chart-type="staticChartType = $event"
                @update:static-display-unit="onStaticDisplayUnitChange"
              />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.global-top-toolbar {
  position: sticky;
  top: 0;
  z-index: 8;
  padding: 4px 0 2px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--p-content-background) 92%, transparent),
    color-mix(in srgb, var(--p-content-background) 72%, transparent)
  );
  backdrop-filter: blur(8px);
}

.standalone-filter-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.standalone-filter-label {
  font-size: 12px;
  line-height: 1;
  color: var(--p-text-muted-color);
  padding-left: 4px;
}

.standalone-filter-control {
  min-width: 148px;
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  color: var(--p-text-color);
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.standalone-filter-control:hover {
  transform: translateY(-1px);
}

.standalone-filter-control:focus {
  border-color: var(--p-primary-500);
  box-shadow: 0 0 0 1px var(--p-primary-500);
}

.range-chip {
  min-width: 54px;
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  color: var(--p-text-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: all 0.2s ease;
}

.range-chip:hover {
  transform: translateY(-1px);
  border-color: var(--p-primary-400);
}

.range-chip.active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.22);
}

.preset-popover-wrap {
  position: relative;
}

.preset-popover-wrap.disabled {
  opacity: 0.76;
}

.preset-trigger-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 156px;
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 88%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--p-content-background) 96%, white 4%),
      color-mix(in srgb, var(--p-content-background) 92%, var(--p-primary-50) 8%)
    );
  color: var(--p-text-color);
  text-align: left;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  box-shadow:
    0 8px 18px color-mix(in srgb, var(--p-primary-color, #3b82f6) 8%, transparent),
    0 1px 0 rgba(255,255,255,0.45) inset;
}

.preset-trigger-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--p-primary-color) 28%, var(--p-content-border-color));
}

.preset-trigger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-trigger-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--p-primary-color);
  line-height: 1.1;
}

.preset-trigger-meta {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.2;
  margin-top: 2px;
}

.preset-popover-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 30;
  width: 290px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 88%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--p-content-background) 98%, white 2%),
      color-mix(in srgb, var(--p-content-background) 94%, transparent)
    );
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.12),
    0 1px 0 rgba(255,255,255,0.55) inset;
  backdrop-filter: blur(12px);
}

.preset-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 82%, transparent);
}

.preset-popover-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--p-text-color);
}

.preset-popover-subtitle {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

.preset-feedback {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
}

.preset-feedback.success {
  color: #166534;
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.18);
}

.preset-feedback.info {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.10);
  border-color: rgba(59, 130, 246, 0.18);
}

.preset-popover-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-popover-item {
  padding: 10px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 86%, transparent);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--p-content-background) 98%, white 2%),
      color-mix(in srgb, var(--p-content-background) 94%, transparent)
    );
}

.preset-popover-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.preset-popover-item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preset-popover-item-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p-text-color);
}

.preset-popover-item-time {
  font-size: 10px;
  color: var(--p-text-muted-color);
  line-height: 1.2;
}

.preset-slot-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.10);
  border: 1px solid rgba(239, 68, 68, 0.16);
}

.preset-slot-state.filled {
  color: #15803d;
  background: rgba(34, 197, 94, 0.10);
  border: 1px solid rgba(34, 197, 94, 0.16);
}

.preset-name-editor {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.preset-name-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 88%, transparent);
  background: color-mix(in srgb, var(--p-content-background) 96%, white 4%);
  color: var(--p-text-color);
  font-size: 11px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.preset-name-input:focus {
  border-color: var(--p-primary-500);
  box-shadow: 0 0 0 1px var(--p-primary-500);
}

.preset-rename-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--p-content-border-color) 88%, transparent);
  background: color-mix(in srgb, var(--p-content-background) 94%, var(--p-primary-50) 6%);
  color: var(--p-primary-color);
  font-size: 11px;
  font-weight: 700;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

.preset-rename-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--p-primary-color) 28%, var(--p-content-border-color));
}

.preset-rename-btn:disabled,
.preset-name-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preset-slot-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-btn {
  flex: 1;
  min-width: 70px;
  height: 30px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.preset-btn.save {
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.18);
}

.preset-btn.save.single {
  min-width: 100%;
}

.preset-btn.load {
  color: var(--p-text-color);
  background: color-mix(in srgb, var(--p-content-background) 96%, white 4%);
  border-color: color-mix(in srgb, var(--p-content-border-color) 90%, transparent);
}

.preset-btn.clear {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.16);
}

.preset-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.preset-btn.load:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--p-primary-color) 28%, var(--p-content-border-color));
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.preset-btn.clear:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.28);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);
}

.preset-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.preset-pop-enter-active,
.preset-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: top right;
}

.preset-pop-enter-from,
.preset-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.preset-status-text {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding-left: 2px;
}

.charts-shell {
  position: relative;
  align-items: flex-start;
  overflow: hidden;
}

.left-chart-panel {
  position: relative;
  z-index: 2;
  flex: 1 1 50%;
  transition:
    flex-basis 0.9s cubic-bezier(.22,1,.36,1),
    width 0.9s cubic-bezier(.22,1,.36,1),
    transform 0.9s cubic-bezier(.22,1,.36,1),
    filter 0.9s cubic-bezier(.22,1,.36,1);
}

.charts-shell.merged .left-chart-panel {
  flex-basis: 100%;
}

.merge-absorb {
  animation: leftAbsorbPulse 0.62s ease-out;
}

@keyframes leftAbsorbPulse {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  35% {
    transform: scale(1.02);
    filter: brightness(1.11);
  }
  100% {
    transform: scale(1);
    filter: brightness(1);
  }
}

.right-chart-panel {
  position: relative;
  z-index: 3;
  transform-origin: center center;
  will-change: transform, opacity, filter;
}

.merge-lift {
  animation: rightLift 0.24s ease-out forwards;
}

@keyframes rightLift {
  from {
    transform: translateY(0) scale(1);
    filter: brightness(1);
  }
  to {
    transform: translateY(-12px) scale(1.015);
    filter: brightness(1.12);
  }
}

.merge-freeze {
  animation: rightFreeze 0.16s ease-out forwards;
}

@keyframes rightFreeze {
  0% {
    transform: translateY(-12px) scale(1.015);
    filter: brightness(1.12);
  }
  100% {
    transform: translateY(-12px) scale(1.02);
    filter: brightness(1.22) saturate(1.08);
  }
}

.freeze-frame-glow {
  position: absolute;
  inset: -4px;
  border-radius: 18px;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 45%, rgba(255,255,255,0.24), transparent 45%),
    linear-gradient(135deg, rgba(59,130,246,0.18), rgba(16,185,129,0.12));
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.12) inset,
    0 0 20px rgba(59,130,246,0.18),
    0 0 38px rgba(16,185,129,0.16);
  animation: freezeGlowPulse 0.16s ease-out forwards;
}

@keyframes freezeGlowPulse {
  0% {
    opacity: 0;
    transform: scale(0.985);
  }
  40% {
    opacity: 1;
    transform: scale(1.005);
  }
  100% {
    opacity: 0.92;
    transform: scale(1);
  }
}

.merge-transfer-out {
  animation: rightTransferOut 0.56s cubic-bezier(.22,1,.36,1) forwards;
}

@keyframes rightTransferOut {
  0% {
    opacity: 1;
    transform: translateY(-12px) scale(1.02);
    filter: blur(0px) brightness(1.2);
  }
  100% {
    opacity: 0;
    transform: translateX(-110px) translateY(-20px) scale(0.9);
    filter: blur(10px) brightness(1.28);
  }
}

.merge-right-panel-enter-active,
.merge-right-panel-leave-active {
  transition:
    opacity 0.45s ease,
    transform 0.45s ease,
    max-width 0.45s ease;
  overflow: hidden;
}

.merge-right-panel-enter-from,
.merge-right-panel-leave-to {
  opacity: 0;
  transform: scale(0.96);
  max-width: 0;
}

.merge-right-panel-enter-to,
.merge-right-panel-leave-from {
  opacity: 1;
  transform: scale(1);
  max-width: 2000px;
}

.merge-fx-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
}

.merge-beam {
  position: absolute;
  top: 41%;
  left: 49%;
  width: 0;
  height: 8px;
  border-radius: 999px;
  opacity: 0;
  transform-origin: right center;
  background:
    linear-gradient(
      90deg,
      rgba(59,130,246,0),
      rgba(59,130,246,0.7),
      rgba(16,185,129,0.75),
      rgba(255,255,255,0)
    );
  box-shadow:
    0 0 12px rgba(59,130,246,0.5),
    0 0 28px rgba(16,185,129,0.35),
    0 0 40px rgba(255,255,255,0.16);
}

.phase-transfer .merge-beam {
  animation: beamFlow 0.56s ease-out forwards;
}

@keyframes beamFlow {
  0% {
    opacity: 0;
    width: 0;
  }
  16% {
    opacity: 1;
    width: 10%;
  }
  70% {
    opacity: 1;
    width: 50%;
  }
  100% {
    opacity: 0;
    width: 56%;
  }
}

.merge-shockwave {
  position: absolute;
  left: 22%;
  top: 44%;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  opacity: 0;
  border: 2px solid rgba(255,255,255,0.8);
  box-shadow:
    0 0 0 6px rgba(59,130,246,0.15),
    0 0 26px rgba(16,185,129,0.24);
}

.phase-absorb .merge-shockwave {
  animation: shockwaveExpand 0.55s ease-out forwards;
}

@keyframes shockwaveExpand {
  0% {
    opacity: 0.85;
    transform: scale(0.2);
  }
  80% {
    opacity: 0.45;
    transform: scale(5.2);
  }
  100% {
    opacity: 0;
    transform: scale(6.2);
  }
}

.merge-flash {
  position: absolute;
  left: 20%;
  top: 39%;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  opacity: 0;
  background:
    radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(59,130,246,0.32) 38%, rgba(16,185,129,0.08) 68%, transparent 100%);
  filter: blur(2px);
}

.phase-absorb .merge-flash {
  animation: flashAbsorb 0.42s ease-out forwards;
}

@keyframes flashAbsorb {
  0% {
    opacity: 0;
    transform: scale(0.45);
  }
  28% {
    opacity: 0.95;
    transform: scale(1.15);
  }
  100% {
    opacity: 0;
    transform: scale(1.85);
  }
}

.snapshot-piece-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.snapshot-piece {
  position: fixed;
  background-repeat: no-repeat;
  border-radius: 2px;
  opacity: 0;
  will-change: transform, opacity, filter;
  animation: snapshotShard 0.78s cubic-bezier(.22,1,.36,1) forwards;
  animation-delay: var(--delay);
  box-shadow: 0 0 14px rgba(59,130,246,0.18);
}

@keyframes snapshotShard {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(1) rotate(0deg);
    filter: blur(0px) brightness(1);
  }
  10% {
    opacity: 1;
    transform: translate(-8px, -6px) scale(1.02) rotate(0deg);
    filter: blur(0px) brightness(1.04);
  }
  55% {
    opacity: 1;
    transform:
      translate(calc(var(--dx) * 0.55), var(--arc))
      scale(0.88)
      rotate(calc(var(--rot) * 0.55));
    filter: blur(1px) brightness(1.08);
  }
  100% {
    opacity: 0;
    transform:
      translate(var(--dx), var(--dy))
      scale(var(--scale))
      rotate(var(--rot));
    filter: blur(6px) brightness(1.18);
  }
}

.page-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(20, 184, 166, 0.10), transparent 30%),
    radial-gradient(circle at 80% 25%, rgba(59, 130, 246, 0.10), transparent 28%),
    radial-gradient(circle at 50% 80%, rgba(168, 85, 247, 0.08), transparent 30%),
    rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(14px) saturate(1.08);
  pointer-events: all;
}

.page-loading-card {
  position: relative;
  min-width: 340px;
  max-width: 420px;
  padding: 30px 28px 24px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(3, 7, 18, 0.96));
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 0 50px rgba(20, 184, 166, 0.08);
  text-align: center;
  overflow: hidden;
}

.page-loading-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      120deg,
      transparent 0%,
      rgba(255,255,255,0.04) 22%,
      transparent 42%
    );
  transform: translateX(-120%);
  animation: loadingShine 2.6s linear infinite;
  pointer-events: none;
}

.page-loading-ring-wrap {
  position: relative;
  width: 84px;
  height: 84px;
  margin: 0 auto 18px;
}

.page-loading-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

.page-loading-ring.ring-back {
  border: 3px solid rgba(148, 163, 184, 0.12);
}

.page-loading-ring.ring-front {
  border: 3px solid transparent;
  border-top-color: #14b8a6;
  border-right-color: #3b82f6;
  animation: luxurySpin 1.1s linear infinite;
  box-shadow: 0 0 24px rgba(20, 184, 166, 0.22);
}

.page-loading-core {
  position: absolute;
  inset: 16px;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(20,184,166,0.32), rgba(59,130,246,0.08) 68%, transparent 100%);
  animation: corePulse 1.8s ease-in-out infinite;
}

.page-loading-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.01em;
}

.page-loading-text {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: #94a3b8;
}

.page-loading-bar {
  position: relative;
  width: 100%;
  height: 7px;
  margin-top: 18px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.12);
}

.page-loading-dots {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.page-loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.75);
  animation: loadingDotPulse 1.2s ease-in-out infinite;
}

.page-loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.page-loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes luxurySpin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes corePulse {
  0%, 100% {
    transform: scale(0.92);
    opacity: 0.72;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes loadingBarRun {
  0% {
    left: -42%;
  }
  100% {
    left: 102%;
  }
}

@keyframes loadingDotPulse {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

@keyframes loadingShine {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(160%);
  }
}

.page-loading-percent {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.04em;
  text-shadow: 0 0 12px rgba(20, 184, 166, 0.22);
}

.page-loading-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    rgba(20, 184, 166, 0.95),
    rgba(59, 130, 246, 0.95)
  );
  box-shadow:
    0 0 16px rgba(20, 184, 166, 0.28),
    0 0 20px rgba(59, 130, 246, 0.18);
  transition: width 0.18s ease-out;
}

.page-loading-bar-glow {
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0),
    rgba(255,255,255,0.75),
    rgba(255,255,255,0)
  );
  mix-blend-mode: screen;
  animation: loadingBarRun 1.4s ease-in-out infinite;
}

@media (max-width: 1200px) {
  .global-top-toolbar {
    align-items: stretch;
  }

  .global-right-tools {
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .standalone-filter-control {
    min-width: 128px;
  }

  .range-chip {
    min-width: 48px;
    padding: 0 12px;
  }

  .preset-trigger-btn {
    min-width: 140px;
  }

  .preset-popover-panel {
    right: 0;
    width: min(290px, calc(100vw - 32px));
  }
}

.component-dropdown option.component-option-header {
  font-weight: 700;
}
</style>