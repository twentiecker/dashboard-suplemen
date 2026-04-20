<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";

import {
  provinceOptions,
  rangeButtons,
  FILTER_OPTIONS,
  LOADING_STAGES,
  TOTAL_BAR_COLOR,
} from "./constants/appChartConstants";

import {
  wait,
  waitUntil,
} from "./utils/asyncHelpers";

import {
  normalizeTextKey,
  normalizeUnitLabel,
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

const dynamicChartType = ref("line");
const staticChartType = ref("line");
const combineBarMode = ref("standard");

const selectedProvince = ref("indonesia");
const selectedRange = ref("8Y");

const componentRuleMode = ref("admin");
// pilihan: admin | pkrt | pkp | pmtb | xm

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);

const isPageBusy = ref(false);

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
  activeSource,
  activeStaticDatasetRef,
  activeStaticDataset,
  activeStaticIndicator,
  activeMappedSource,
  dynamicIndicatorUnitMap,
  cards,
  isLoadingCards,
  filteredPdbIndicatorOptions,
  globalComponentOptions,
  loadPdbComponentOptions,
  loadCardsFromMappedSource,
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

/**
 * Bridge refs untuk memutus circular dependency antar composable
 */
const isGabungBridge = ref(false);
const isCombineDisabledBridge = ref(false);

const hasStaticNilaiQuarterlyBridge = ref(false);
const hasStaticNilaiYearlyBridge = ref(false);
const hasStaticGrowthQuarterlyBridge = ref(false);
const hasStaticGrowthYearlyBridge = ref(false);

const {
  primaryRawConfig,
  primaryAggregation,
  primaryMethod,
  allowPrimaryMonthlyByMeta,
  allowPrimaryQuarterlyByMeta,
  allowPrimaryYearlyByMeta,
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
  getEffectiveAggregation,
  getAxisLevelCount,
  combineTargetAggregations,
  combineTargetAxisLevels,
  getAxisLevelCountFromSelections,
  getAxisLevelCountForCardSelection,
  isPrimaryMonthlyDisabled,
  isPrimaryQuarterlyDisabled,
  isPrimaryYearlyDisabled,
  isStaticQuarterlyDisabled,
  isStaticYearlyDisabled,
  isCardMonthlyDisabled,
  isCardQuarterlyDisabled,
  isCardYearlyDisabled,
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

const activeMonthlyMethod = computed(() => {
  if (primaryMeasure.value !== "pertumbuhan" || primaryAggregation.value !== "monthly") return "";
  return primaryMethod.value ?? "";
});

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

/**
 * Bridge chartDataL untuk useChartLogic
 */
const chartDataLBridge = ref({
  labels: [],
  datasets: [],
});

const useStackPeriodMerge = computed(() =>
  canUsePeriodStackMerge.value && combineBarMode.value === "stack"
);

const {
  theme,
  hasStaticNilaiQuarterly,
  hasStaticNilaiYearly,
  hasStaticGrowthQuarterly,
  hasStaticGrowthYearly,
  staticSeriesMeta,
  leftPreparedDynamicSeries,
  compatibleLeftSeries,
  activeLeftSeries,
  hasGrowthSeriesLeft,
  hasValueSeriesLeft,
  hasMixedMeasureKindsLeft,
  leftPrimaryUnitTitle,
  leftSecondaryUnitTitle,
  staticAxisTitle,
  activeDatasetOrderMap,
  hasIncompatibleLeftSeries,
  hasMonthlySeriesLeft,
  hasQuarterlySeriesLeft,
  hasYearlySeriesLeft,
  isMixedMonthlyQuarterlyAxis,
  leftMonthlyAxisPeriods,
  leftQuarterlyAxisPeriods,
  leftYearlyAxisPeriods,
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
});


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

function getLegendLabelWithUnit(dataset, measure = "nilai") {
  const name = getDatasetDisplayName(dataset);
  const unit = getDatasetUnitLabel(dataset, measure);
  return unit ? `${name} (${unit})` : name;
}

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

function buildMonthlyQuarterlyMergeDatasets(leftSeries, staticDataset) {
  const quarterlyMeta = getSeriesMeta(staticDataset, "quarterly");
  const trimmedQuarterlyMeta = trimMetaByRange(quarterlyMeta, selectedRange.value);
  const quarterPeriods = trimmedQuarterlyMeta.periods ?? [];
  const quarterTotals = trimmedQuarterlyMeta.data ?? [];

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
    const monthlyPeriods = seriesItem.meta.periods ?? [];
    const monthlyValues = seriesItem.meta.data ?? [];
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
    label: `${getDatasetDisplayName(staticDataset)} - Total Triwulan`,
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
  const yearPeriods = (trimmedYearlyMeta.periods ?? []).map(normalizeYearLikePeriod);
  const yearTotals = trimmedYearlyMeta.data ?? [];

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
    const monthlyPeriods = seriesItem.meta.periods ?? [];
    const monthlyValues = seriesItem.meta.data ?? [];
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
    label: `${getDatasetDisplayName(staticDataset)} - Total Tahunan`,
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
  const yearPeriods = (trimmedYearlyMeta.periods ?? []).map(normalizeYearLikePeriod);
  const yearTotals = trimmedYearlyMeta.data ?? [];

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
    const quarterPeriods = seriesItem.meta.periods ?? [];
    const quarterValues = seriesItem.meta.data ?? [];
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
    label: `${getDatasetDisplayName(yearlyDataset)} - Total Tahunan`,
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
    const tooltipMeta = createDatasetTooltipMeta({
      periods: item.meta.periods,
      sourceAggregation: item.aggregation,
    });

    const yAxisID = hasMixedMeasureKindsLeft.value
      ? (item.measure === "pertumbuhan" ? "y1" : "y")
      : "y";

    return {
      label: getLegendLabelWithUnit(item.dataset, item.measure),
      data: toPointData(item.meta),
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

    const staticYAxisID = hasMixedMeasureKindsLeft.value
      ? (staticMeasure.value === "pertumbuhan" ? "y1" : "y")
      : "y";

    dyn.push({
      label: getLegendLabelWithUnit(staticDs, staticMeasure.value),
      data: toPointData(staticSeriesMeta.value),
      ...createDatasetTooltipMeta({
        periods: staticSeriesMeta.value.periods,
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

const chartDataR = computed(() => ({
  labels: [],
  datasets:
    activeStaticDataset.value && staticPeriod.value
      ? [
          {
            ...activeStaticDataset.value,
            label: getLegendLabelWithUnit(activeStaticDataset.value, staticMeasure.value),
            data: toPointData(staticSeriesMeta.value),
            ...createDatasetTooltipMeta({
              periods: staticSeriesMeta.value.periods,
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
}));

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

        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.fillStyle = theme.value.text || "#E5E7EB";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(Number(val).toFixed(2), x, y - 8);
        ctx.restore();
      });
    });
  },
};

onMounted(async () => {
  await withPageBusy(async () => {
    await loadPdbComponentOptions();
    const result = await reloadBySelectedComponent();
    staticPeriod.value = result.staticPeriod;
    staticMethod.value = result.staticMethod;
  });
});

watch(staticComponent, async (val, oldVal) => {
  if (!val) {
    staticPeriod.value = "";
    staticMethod.value = "";
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
      return [
        item.dataset.id,
        item.aggregation,
        item.meta?.periods?.[0] ?? "",
        item.meta?.periods?.length ?? 0,
        item.measure ?? "",
        item.unitLabel ?? "",
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
    dynamicChartType.value ?? "",
    staticChartType.value ?? "",
    staticMeasure.value ?? "",
    staticPeriod.value ?? "",
    staticMethod.value ?? "",
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
            <div class="theme-filter-panel mb-3 rounded-lg border p-3">
              <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <label class="theme-text-muted mb-1 block text-[12px]">Pilih Tampilan</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    :value="primaryMeasure ?? ''"
                    @change="onPrimaryMeasureChange"
                    :disabled="isPageBusy"
                  >
                    <option value="" disabled>Pilih tampilan</option>
                    <option
                      v-for="opt in FILTER_OPTIONS.measure"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-if="showPrimaryAggregationFilter">
                  <label class="theme-text-muted mb-1 block text-[12px]">Pilih Periode</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    :value="primaryAggregation ?? ''"
                    @change="onPrimaryAggregationChange"
                    :disabled="isPageBusy"
                  >
                    <option value="" disabled>Pilih periode</option>
                    <option value="monthly" :disabled="isPrimaryMonthlyDisabled">Bulanan</option>
                    <option value="quarterly" :disabled="isPrimaryQuarterlyDisabled">Triwulanan</option>
                    <option value="yearly" :disabled="isPrimaryYearlyDisabled">Tahunan</option>
                  </select>
                </div>

                <div v-if="showPrimaryMethodFilter && primaryAggregation === 'monthly'">
                  <label class="theme-text-muted mb-1 block text-[12px]">Metode Bulanan</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    :value="primaryMethod ?? ''"
                    @change="onPrimaryMethodChange"
                    :disabled="isPageBusy"
                  >
                    <option value="" disabled>Pilih metode</option>
                    <option
                      v-for="opt in FILTER_OPTIONS.monthlyMethods"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-if="showPrimaryMethodFilter && primaryAggregation === 'quarterly'">
                  <label class="theme-text-muted mb-1 block text-[12px]">Metode Triwulanan</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    :value="primaryMethod ?? ''"
                    @change="onPrimaryMethodChange"
                    :disabled="isPageBusy"
                  >
                    <option value="" disabled>Pilih metode</option>
                    <option
                      v-for="opt in FILTER_OPTIONS.quarterlyMethods"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-show="showDynamicChartTypeFilter">
                  <label class="theme-text-muted mb-1 block text-[12px]">Tipe Chart Dinamis</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    v-model="dynamicChartType"
                    :disabled="isPageBusy"
                  >
                    <option
                      v-for="opt in FILTER_OPTIONS.chartTypes"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-show="showStackBarFilter && showCombineBarModeFilter">
                  <label class="theme-text-muted mb-1 block text-[12px]">Mode Bar Gabungan</label>
                  <select
                    class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                    v-model="combineBarMode"
                    :disabled="isPageBusy"
                  >
                    <option
                      v-for="opt in FILTER_OPTIONS.combineBarModes"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <Chart
              :key="leftChartKey"
              :type="dynamicChartType"
              :data="chartDataL"
              :options="chartOptionsL"
              :plugins="[valueLabelPlugin]"
              class="chart-left-dynamic h-120"
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

              <div class="theme-filter-panel mb-3 rounded-lg border p-3">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div v-if="showStaticPeriodFilter">
                    <label class="theme-text-muted mb-1 block text-[12px]">Pilih Tampilan</label>
                    <select
                      class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                      v-model="staticMeasure"
                      :disabled="isPageBusy"
                    >
                      <option
                        v-for="opt in FILTER_OPTIONS.measure"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-if="showStaticPeriodFilter">
                    <label class="theme-text-muted mb-1 block text-[12px]">Pilih Periode</label>
                    <select
                      class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                      v-model="staticPeriod"
                      :disabled="isPageBusy"
                    >
                      <option value="" disabled>Pilih periode</option>
                      <option
                        v-for="opt in FILTER_OPTIONS.staticPeriod"
                        :key="opt.value"
                        :value="opt.value"
                        :disabled="opt.value === 'quarterly' ? isStaticQuarterlyDisabled : isStaticYearlyDisabled"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-if="showStaticMethodFilter">
                    <label class="theme-text-muted mb-1 block text-[12px]">Metode</label>
                    <select
                      class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                      v-model="staticMethod"
                      :disabled="isPageBusy"
                    >
                      <option value="" disabled>Pilih metode</option>
                      <option
                        v-for="opt in FILTER_OPTIONS.staticQuarterlyMethods"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-show="showStaticChartTypeFilter">
                    <label class="theme-text-muted mb-1 block text-[12px]">Tipe Chart Statistik</label>
                    <select
                      class="theme-select w-full rounded-md px-2 py-2 text-[13px]"
                      v-model="staticChartType"
                      :disabled="isPageBusy"
                    >
                      <option
                        v-for="opt in FILTER_OPTIONS.chartTypes"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <p
                  v-if="staticComponent && !activeMappedSource"
                  class="mt-3 text-[12px] text-amber-400"
                >
                  Komponen ini belum memiliki data indikator untuk chart dinamis, jadi panel kiri dikosongkan sementara. Chart statis tetap menggunakan data PDB.
                </p>
              </div>

              <Chart
                :key="rightChartKey"
                :type="staticChartType"
                :data="chartDataR"
                :options="chartOptionsR"
                :plugins="[valueLabelPlugin]"
                class="h-120"
              />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-text-muted {
  color: var(--p-text-muted-color);
}

.theme-filter-panel {
  border-color: var(--p-content-border-color);
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
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

.page-loading-bg-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(24px);
  opacity: 0.55;
  animation: orbFloat 6s ease-in-out infinite;
}

.page-loading-bg-orb.orb-1 {
  width: 180px;
  height: 180px;
  background: rgba(20, 184, 166, 0.16);
  top: 18%;
  left: 28%;
}

.page-loading-bg-orb.orb-2 {
  width: 220px;
  height: 220px;
  background: rgba(59, 130, 246, 0.14);
  right: 26%;
  top: 24%;
  animation-delay: 1.2s;
}

.page-loading-bg-orb.orb-3 {
  width: 160px;
  height: 160px;
  background: rgba(168, 85, 247, 0.14);
  bottom: 18%;
  left: 46%;
  animation-delay: 2.1s;
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

@keyframes orbFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-14px) scale(1.06);
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
}

.standalone-filter-control-wide {
  min-width: 240px;
  max-width: 320px;
}

.component-dropdown option.component-option-header {
  font-weight: 700;
}
</style>