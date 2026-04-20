import { computed } from "vue";
import { datasetHasAggregationData } from "../utils/chartHelpers";

export function useFilterLogic({
  chartStore,
  isGabung,
  primaryDataset,
  primaryMeasure,
  staticComponent,
  staticPeriod,
  staticMeasure,
  activeStaticDataset,
  activeMappedSource,
  hasStaticNilaiQuarterly,
  hasStaticNilaiYearly,
  hasStaticGrowthQuarterly,
  hasStaticGrowthYearly,
}) {
  const primaryRawConfig = computed(() => {
    if (!primaryDataset.value) return null;
    const id = String(primaryDataset.value.id);
    return chartStore.compareConfigs[id] ?? null;
  });

  const primaryAggregation = computed(() => primaryRawConfig.value?.aggregation ?? "");
  const primaryMethod = computed(() => primaryRawConfig.value?.method ?? "");

  const allowPrimaryMonthlyByMeta = computed(() => {
    const value = primaryDataset.value?.aggregationAvailability?.allowMonthly;
    return typeof value === "boolean" ? value : true;
  });

  const allowPrimaryQuarterlyByMeta = computed(() => {
    const value = primaryDataset.value?.aggregationAvailability?.allowQuarterly;
    return typeof value === "boolean" ? value : true;
  });

  const allowPrimaryYearlyByMeta = computed(() => {
    const value = primaryDataset.value?.aggregationAvailability?.allowYearly;
    return typeof value === "boolean" ? value : true;
  });

  const canChoosePrimaryMonthly = computed(() =>
    datasetHasAggregationData(
      primaryDataset.value,
      "monthly",
      primaryMeasure.value || "nilai"
    )
  );

  const canChoosePrimaryQuarterly = computed(() =>
    datasetHasAggregationData(
      primaryDataset.value,
      "quarterly",
      primaryMeasure.value || "nilai"
    )
  );

  const canChoosePrimaryYearly = computed(() =>
    datasetHasAggregationData(
      primaryDataset.value,
      "yearly",
      primaryMeasure.value || "nilai"
    )
  );

  const onPrimaryMeasureChange = (e) => {
    if (!primaryDataset.value) return;
    chartStore.setMeasure(primaryDataset.value.id, e.target.value);
  };

  const onPrimaryAggregationChange = (e) => {
    if (!primaryDataset.value) return;
    chartStore.setAggregation(primaryDataset.value.id, e.target.value);
  };

  const onPrimaryMethodChange = (e) => {
    if (!primaryDataset.value) return;
    chartStore.setMethod(primaryDataset.value.id, e.target.value);
  };

  const showPrimaryAggregationFilter = computed(() =>
    !!primaryDataset.value && !!primaryMeasure.value
  );

  const showPrimaryMethodFilter = computed(
    () =>
      !!primaryDataset.value &&
      primaryMeasure.value === "pertumbuhan" &&
      !!primaryAggregation.value &&
      primaryAggregation.value !== "yearly"
  );

  const showStaticPeriodFilter = computed(() => !!staticComponent.value);

  const showStaticMethodFilter = computed(
    () =>
      !!staticComponent.value &&
      staticMeasure.value === "pertumbuhan" &&
      staticPeriod.value === "quarterly"
  );

  const getEffectiveAggregation = (dataset) => {
    const id = String(dataset.id);
    const rawConfig = chartStore.compareConfigs[id] ?? null;

    if (rawConfig?.aggregation) return rawConfig.aggregation;

    if (dataset?.aggregationAvailability?.allowMonthly) return "monthly";
    if (dataset?.aggregationAvailability?.allowQuarterly) return "quarterly";
    if (dataset?.aggregationAvailability?.allowYearly) return "yearly";

    return dataset.rawFrequency === "monthly"
      ? "monthly"
      : dataset.rawFrequency === "quarterly"
        ? "quarterly"
        : "yearly";
  };

  const getAxisLevelCount = (aggregations) => {
    const uniq = [...new Set(aggregations)];
    const hasMonthly = uniq.includes("monthly");
    const hasQuarterly = uniq.includes("quarterly");
    const hasYearly = uniq.includes("yearly");

    if (hasMonthly && hasQuarterly && hasYearly) return 3;
    if (
      (hasMonthly && hasQuarterly) ||
      (hasMonthly && hasYearly) ||
      (hasQuarterly && hasYearly)
    ) {
      return 2;
    }
    return 1;
  };

  const combineTargetAggregations = computed(() => {
    const result = chartStore.selectedDataset.map((ds) => getEffectiveAggregation(ds));
    if (staticComponent.value && staticPeriod.value) {
      result.push(staticPeriod.value === "yearly" ? "yearly" : "quarterly");
    }
    return result;
  });

  const combineTargetAxisLevels = computed(() =>
    getAxisLevelCount(combineTargetAggregations.value)
  );

  const getAxisLevelCountFromSelections = ({
    primaryAggregationCandidate = primaryAggregation.value,
    staticPeriodCandidate = staticPeriod.value,
  } = {}) => {
    const result = [];

    chartStore.selectedDataset.forEach((ds, index) => {
      if (index === 0) {
        if (primaryAggregationCandidate) {
          result.push(primaryAggregationCandidate);
        }
      } else {
        result.push(getEffectiveAggregation(ds));
      }
    });

    if (staticComponent.value && staticPeriodCandidate) {
      result.push(staticPeriodCandidate === "yearly" ? "yearly" : "quarterly");
    }

    return getAxisLevelCount(result);
  };

  const getAxisLevelCountForCardSelection = ({
    cardId,
    aggregationCandidate,
    staticPeriodCandidate = staticPeriod.value,
  } = {}) => {
    const result = [];

    chartStore.selectedDataset.forEach((ds) => {
      const id = String(ds.id);
      if (id === String(cardId)) {
        if (aggregationCandidate) {
          result.push(aggregationCandidate);
        } else {
          result.push(getEffectiveAggregation(ds));
        }
      } else {
        result.push(getEffectiveAggregation(ds));
      }
    });

    if (staticComponent.value && staticPeriodCandidate && activeMappedSource.value) {
      result.push(staticPeriodCandidate === "yearly" ? "yearly" : "quarterly");
    }

    return getAxisLevelCount(result);
  };

  const isPrimaryMonthlyDisabled = computed(() => {
    if (!primaryDataset.value) return true;
    if (!allowPrimaryMonthlyByMeta.value) return true;
    if (!canChoosePrimaryMonthly.value) return true;
    if (!isGabung.value) return false;
    if (!primaryMeasure.value) return false;

    return getAxisLevelCountFromSelections({
      primaryAggregationCandidate: "monthly",
      staticPeriodCandidate: staticPeriod.value,
    }) > 2;
  });

  const isPrimaryQuarterlyDisabled = computed(() => {
    if (!primaryDataset.value) return true;
    if (!allowPrimaryQuarterlyByMeta.value) return true;
    if (!canChoosePrimaryQuarterly.value) return true;
    if (!isGabung.value) return false;
    if (!primaryMeasure.value) return false;

    return getAxisLevelCountFromSelections({
      primaryAggregationCandidate: "quarterly",
      staticPeriodCandidate: staticPeriod.value,
    }) > 2;
  });

  const isPrimaryYearlyDisabled = computed(() => {
    if (!primaryDataset.value) return true;
    if (!allowPrimaryYearlyByMeta.value) return true;
    if (!canChoosePrimaryYearly.value) return true;
    if (!isGabung.value) return false;
    if (!primaryMeasure.value) return false;

    return getAxisLevelCountFromSelections({
      primaryAggregationCandidate: "yearly",
      staticPeriodCandidate: staticPeriod.value,
    }) > 2;
  });

  const isStaticQuarterlyDisabled = computed(() => {
    if (!staticComponent.value) return true;
    if (!activeStaticDataset.value) return true;

    const hasData =
      staticMeasure.value === "nilai"
        ? hasStaticNilaiQuarterly.value
        : hasStaticGrowthQuarterly.value;

    if (!hasData) return true;

    if (!isGabung.value) return false;

    return getAxisLevelCountFromSelections({
      primaryAggregationCandidate: primaryAggregation.value,
      staticPeriodCandidate: "quarterly",
    }) > 2;
  });

  const isStaticYearlyDisabled = computed(() => {
    if (!staticComponent.value) return true;
    if (!activeStaticDataset.value) return true;

    const hasData =
      staticMeasure.value === "nilai"
        ? hasStaticNilaiYearly.value
        : hasStaticGrowthYearly.value;

    if (!hasData) return true;

    if (!isGabung.value) return false;

    return getAxisLevelCountFromSelections({
      primaryAggregationCandidate: primaryAggregation.value,
      staticPeriodCandidate: "yearly",
    }) > 2;
  });

  const isCardMonthlyDisabled = (card) => {
    if (!card) return true;

    const cardConfig = chartStore.getCompareConfig(card) ?? {};
    const measure = cardConfig.measure ?? "nilai";

    if (!datasetHasAggregationData(card, "monthly", measure)) return true;
    if (!isGabung.value) return false;

    return getAxisLevelCountForCardSelection({
      cardId: card.id,
      aggregationCandidate: "monthly",
    }) > 2;
  };

  const isCardQuarterlyDisabled = (card) => {
    if (!card) return true;

    const cardConfig = chartStore.getCompareConfig(card) ?? {};
    const measure = cardConfig.measure ?? "nilai";

    if (!datasetHasAggregationData(card, "quarterly", measure)) return true;
    if (!isGabung.value) return false;

    return getAxisLevelCountForCardSelection({
      cardId: card.id,
      aggregationCandidate: "quarterly",
    }) > 2;
  };

  const isCardYearlyDisabled = (card) => {
    if (!card) return true;

    const cardConfig = chartStore.getCompareConfig(card) ?? {};
    const measure = cardConfig.measure ?? "nilai";

    return !datasetHasAggregationData(card, "yearly", measure);
  };

  const isCombineDisabled = computed(() => combineTargetAxisLevels.value > 2);

  const combineDisabledMessage = computed(() => {
    if (!isCombineDisabled.value) return "";
    return "Fitur gabungkan dinonaktifkan karena kombinasi filter ini membutuhkan 3 sumbu X sekaligus, sedangkan maksimum hanya 2.";
  });

  return {
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
  };
}