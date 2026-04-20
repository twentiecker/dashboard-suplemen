import { computed } from "vue";
import { palette } from "../constants/appChartConstants";
import {
  isFiniteNumber,
  hasValidSeriesData,
  getSeriesMeta,
  getBackendGrowthMeta,
  trimMetaByRange,
  dedupePeriods,
  getPreparedSeriesMeta,
  getAxisTitleForMeasure,
  formatTooltipPeriod,
  getTooltipPeriodForContext,
  getTooltipAggregationForContext,
  buildMonthlyTickLabel,
  buildQuarterlyTickLabel,
  formatYearTick,
  formatQuarterMergeTickLabel,
  formatYearMergeTickLabel,
} from "../utils/chartHelpers";

export function useChartLogic({
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
  chartDataL,
  useStackPeriodMerge,
  shouldStackQuarterly,
  shouldStackYearly,
  activeMonthlyMethod,
  getDatasetUnitLabel,
}) {
  const theme = computed(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue("--p-primary-500").trim(),
      text: style.getPropertyValue("--p-text-color").trim(),
      textSecondary: style.getPropertyValue("--p-text-muted-color").trim(),
      border: style.getPropertyValue("--p-content-border-color").trim(),
      panelBg: style.getPropertyValue("--p-content-background").trim(),
    };
  });

  const hasStaticNilaiQuarterly = computed(() => {
    const ds = activeStaticDataset.value;
    if (!ds) return false;

    return (
      Array.isArray(ds?.derivedPeriods?.quarterly) &&
      ds.derivedPeriods.quarterly.length > 0 &&
      Array.isArray(ds?.series?.quarterly) &&
      ds.series.quarterly.some((value) => isFiniteNumber(value))
    );
  });

  const hasStaticNilaiYearly = computed(() => {
    const ds = activeStaticDataset.value;
    if (!ds) return false;

    return (
      Array.isArray(ds?.derivedPeriods?.yearly) &&
      ds.derivedPeriods.yearly.length > 0 &&
      Array.isArray(ds?.series?.yearly) &&
      ds.series.yearly.some((value) => isFiniteNumber(value))
    );
  });

  const hasStaticGrowthQuarterly = computed(() => {
    const ds = activeStaticDataset.value;
    if (!ds) return false;

    return (
      hasValidSeriesData(ds?.growth?.quarterly?.qtoq) ||
      hasValidSeriesData(ds?.growth?.quarterly?.yony) ||
      hasValidSeriesData(ds?.growth?.quarterly?.ctoc)
    );
  });

  const hasStaticGrowthYearly = computed(() => {
    const ds = activeStaticDataset.value;
    if (!ds) return false;

    return hasValidSeriesData(ds?.growth?.yearly);
  });

  const staticSeriesMeta = computed(() => {
    if (!activeStaticDataset.value || !staticPeriod.value) {
      return { data: [], periods: [], aggregation: "quarterly" };
    }

    const aggregation = staticPeriod.value === "yearly" ? "yearly" : "quarterly";
    let meta;

    if (staticMeasure.value === "nilai") {
      meta = getSeriesMeta(activeStaticDataset.value, aggregation);
    } else {
      const baseMeta = getSeriesMeta(activeStaticDataset.value, aggregation);

      if (aggregation === "yearly") {
        meta = getBackendGrowthMeta(
          activeStaticDataset.value,
          "yearly",
          "annual",
          baseMeta.periods
        );
      } else {
        meta = getBackendGrowthMeta(
          activeStaticDataset.value,
          "quarterly",
          staticMethod.value || "qtoq",
          baseMeta.periods
        );
      }
    }

    return trimMetaByRange(meta, selectedRange.value);
  });

  const leftPreparedDynamicSeries = computed(() =>
    chartStore.selectedDataset.map((ds) => {
      const idx = chartStore.selectedDataset.findIndex((item) => item.id === ds.id);
      const colors = palette[idx] ?? palette[0];
      const config = chartStore.getCompareConfig(ds);
      const rawMeta = getPreparedSeriesMeta(ds, config);
      const meta = trimMetaByRange(rawMeta, selectedRange.value);

      return {
        dataset: ds,
        meta,
        aggregation: meta.aggregation,
        colors,
        measure: config?.measure ?? "nilai",
        unitLabel: getDatasetUnitLabel(ds, config?.measure ?? "nilai"),
      };
    })
  );

  const compatibleLeftSeries = computed(() =>
    leftPreparedDynamicSeries.value.filter((item) => {
      return item.meta.aggregation === primaryAggregation.value;
    })
  );

  const activeLeftSeries = computed(() => {
    if (!primaryDataset.value) return [];

    if (!useStackPeriodMerge.value) {
      return leftPreparedDynamicSeries.value;
    }

    return compatibleLeftSeries.value;
  });

  const hasGrowthSeriesLeft = computed(() =>
    activeLeftSeries.value.some((item) => item.measure === "pertumbuhan")
  );

  const hasValueSeriesLeft = computed(() =>
    activeLeftSeries.value.some((item) => item.measure !== "pertumbuhan")
  );

const hasMixedMeasureKindsLeft = computed(() => {
  const kinds = new Set(
    activeLeftSeries.value.map((item) =>
      item.measure === "pertumbuhan" ? "pertumbuhan" : "nilai"
    )
  );

  if (isGabung.value && activeStaticDataset.value && staticPeriod.value) {
    kinds.add(staticMeasure.value === "pertumbuhan" ? "pertumbuhan" : "nilai");
  }

  return kinds.has("nilai") && kinds.has("pertumbuhan");
});

  const leftPrimaryUnitTitle = computed(() => {
    if (hasMixedMeasureKindsLeft.value) return "NILAI";
    if (hasGrowthSeriesLeft.value && !hasValueSeriesLeft.value) return "PERTUMBUHAN (%)";
    return "NILAI";
  });

  const leftSecondaryUnitTitle = computed(() => {
    if (hasMixedMeasureKindsLeft.value) return "PERTUMBUHAN (%)";
    return "";
  });

  const staticAxisTitle = computed(() =>
    getAxisTitleForMeasure(staticMeasure.value)
  );

  const activeDatasetOrderMap = computed(() => {
    const map = {};

    activeLeftSeries.value.forEach((item, index) => {
      map[String(item.dataset.id)] = index;
    });

    return map;
  });

  const hasIncompatibleLeftSeries = computed(() =>
    leftPreparedDynamicSeries.value.length !== compatibleLeftSeries.value.length
  );

  const hasMonthlySeriesLeft = computed(() =>
    activeLeftSeries.value.some((item) => item.aggregation === "monthly")
  );

  const hasQuarterlySeriesLeft = computed(() => {
    if (activeLeftSeries.value.some((item) => item.aggregation === "quarterly")) return true;
    return !!activeStaticDataset.value && staticPeriod.value === "quarterly";
  });

  const hasYearlySeriesLeft = computed(() =>
    activeLeftSeries.value.some((item) => item.aggregation === "yearly") ||
    (!!activeStaticDataset.value && staticPeriod.value === "yearly")
  );

  const isMixedMonthlyQuarterlyAxis = computed(() =>
    hasMonthlySeriesLeft.value && hasQuarterlySeriesLeft.value && !hasYearlySeriesLeft.value
  );

  const leftMonthlyAxisPeriods = computed(() => {
    const periods = [];
    activeLeftSeries.value.forEach((item) => {
      if (item.aggregation === "monthly") periods.push(...item.meta.periods);
    });
    return dedupePeriods(periods);
  });

  const leftQuarterlyAxisPeriods = computed(() => {
    const periods = [];
    activeLeftSeries.value.forEach((item) => {
      if (item.aggregation === "quarterly") periods.push(...item.meta.periods);
    });

    return dedupePeriods(periods);
  });

  const leftYearlyAxisPeriods = computed(() => {
    const periods = [];
    activeLeftSeries.value.forEach((item) => {
      if (item.aggregation === "yearly") periods.push(...item.meta.periods);
    });

    return dedupePeriods(periods);
  });

  const leftAxisVisibility = computed(() => {
    if (useStackPeriodMerge.value) {
      return {
        monthly: false,
        quarterly: false,
        yearly: false,
      };
    }

    return {
      monthly: leftMonthlyAxisPeriods.value.length > 0,
      quarterly: leftQuarterlyAxisPeriods.value.length > 0,
      yearly: leftYearlyAxisPeriods.value.length > 0,
    };
  });

  const rightAxisVisibility = computed(() => ({
    monthly: false,
    quarterly: staticPeriod.value === "quarterly",
    yearly: staticPeriod.value === "yearly",
  }));

  const buildChartOptions = (chartTypeRef, isRightChart = false) =>
    computed(() => {
      const axisVisibility = isRightChart ? rightAxisVisibility.value : leftAxisVisibility.value;
      const monthlyPeriods = isRightChart ? [] : leftMonthlyAxisPeriods.value;
      const quarterlyPeriods = isRightChart
        ? (staticPeriod.value === "quarterly" ? staticSeriesMeta.value.periods : [])
        : leftQuarterlyAxisPeriods.value;
      const yearlyPeriods = isRightChart
        ? (staticPeriod.value === "yearly" ? staticSeriesMeta.value.periods : [])
        : leftYearlyAxisPeriods.value;

      return {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeInOutQuart",
        },
        animations: {
          x: { duration: 900, easing: "easeInOutQuart" },
          y: { duration: 900, easing: "easeInOutQuart" },
          tension: { duration: 900, easing: "easeInOutQuart" },
          radius: { duration: 900, easing: "easeInOutQuart" },
        },
        transitions: {
          active: {
            animation: {
              duration: 300,
            },
          },
        },
        layout: {
          padding: {
            left: 14,
            right: 12,
            top: 16,
            bottom: 8,
          },
        },
        plugins: {
          legend: {
            labels: {
              color: theme.value.text,
              boxWidth: 42,
              boxHeight: 14,
              padding: 12,
            },
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title(items) {
                if (!items?.length) return "";

                const uniquePeriods = [...new Set(
                  items
                    .map((item) => {
                      const period = getTooltipPeriodForContext(item);
                      const aggregation = getTooltipAggregationForContext(item);
                      return formatTooltipPeriod(
                        period,
                        aggregation,
                        primaryAggregation.value
                      );
                    })
                    .filter(Boolean)
                )];

                if (uniquePeriods.length === 1) {
                  return uniquePeriods[0];
                }

                return "";
              },
              label(context) {
                const label = context.dataset?.label ?? "";
                const value = context.parsed?.y;
                const tooltipPeriod = getTooltipPeriodForContext(context);
                const aggregation = getTooltipAggregationForContext(context);
                const formattedPeriod = formatTooltipPeriod(
                  tooltipPeriod,
                  aggregation,
                  primaryAggregation.value
                );

                const formattedValue =
                  value === null || value === undefined
                    ? "-"
                    : Number(value).toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      });

                if (formattedPeriod) {
                  return `${label} (${formattedPeriod}): ${formattedValue}`;
                }

                return `${label}: ${formattedValue}`;
              },
            },
          },
        },
        scales: {
          xMonthly: {
            type: "category",
            position: "bottom",
            display: axisVisibility.monthly,
            offset: chartTypeRef.value === "bar",
            stacked: false,
            labels: monthlyPeriods,
            ticks: {
              color: theme.value.textSecondary,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback(value, index) {
                const raw = this.getLabelForValue(value);
                return buildMonthlyTickLabel(
                  raw,
                  index,
                  monthlyPeriods.length,
                  activeMonthlyMethod.value
                );
              },
            },
            grid: { color: theme.value.border },
            title: { display: false },
          },
          xQuarterly: {
            type: "category",
            position: "bottom",
            display: axisVisibility.quarterly,
            offset: chartTypeRef.value === "bar",
            stacked: shouldStackQuarterly.value,
            labels: quarterlyPeriods,
            ticks: {
              color: theme.value.textSecondary,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback(value, index) {
                const raw = this.getLabelForValue(value);
                return buildQuarterlyTickLabel(
                  raw,
                  index,
                  quarterlyPeriods.length,
                  isMixedMonthlyQuarterlyAxis.value || isRightChart
                );
              },
            },
            grid: {
              display: !axisVisibility.monthly,
              color: theme.value.border,
            },
          },
          xYearly: {
            type: "category",
            position: "bottom",
            display: axisVisibility.yearly,
            offset: chartTypeRef.value === "bar",
            stacked: shouldStackYearly.value,
            labels: yearlyPeriods,
            ticks: {
              color: theme.value.textSecondary,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback(value) {
                const raw = this.getLabelForValue(value);
                return formatYearTick(raw);
              },
            },
            grid: {
              display: !axisVisibility.monthly && !axisVisibility.quarterly,
              color: theme.value.border,
            },
          },
          xQuarterlyMerge: {
            type: "category",
            position: "bottom",
            display: !isRightChart && useStackPeriodMerge.value && staticPeriod.value === "quarterly",
            offset: true,
            stacked: true,
            labels: chartDataL.value.labels ?? [],
            ticks: {
              color: theme.value.textSecondary,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback(value) {
                const raw = this.getLabelForValue(value);
                return formatQuarterMergeTickLabel(raw);
              },
            },
            grid: { color: theme.value.border },
          },
          xYearlyMerge: {
            type: "category",
            position: "bottom",
            display: !isRightChart && useStackPeriodMerge.value && staticPeriod.value === "yearly",
            offset: true,
            stacked: true,
            labels: chartDataL.value.labels ?? [],
            ticks: {
              color: theme.value.textSecondary,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback(value) {
                const raw = this.getLabelForValue(value);
                return formatYearMergeTickLabel(raw, primaryAggregation.value);
              },
            },
            grid: { color: theme.value.border },
          },
          y: {
            position: "left",
            beginAtZero: false,
            stacked: useStackPeriodMerge.value,
            ticks: { color: theme.value.textSecondary },
            grid: { color: theme.value.border },
            title: {
              display: true,
              color: theme.value.textSecondary,
              text: isRightChart ? staticAxisTitle.value : leftPrimaryUnitTitle.value,
            },
          },
          y1: {
            position: "right",
            beginAtZero: false,
            stacked: useStackPeriodMerge.value || shouldStackQuarterly.value || shouldStackYearly.value,
            display: !isRightChart && hasMixedMeasureKindsLeft.value,
            ticks: { color: theme.value.textSecondary },
            grid: { drawOnChartArea: false },
            title: {
              display: !isRightChart && hasMixedMeasureKindsLeft.value,
              color: theme.value.textSecondary,
              text: leftSecondaryUnitTitle.value,
            },
          },
        },
      };
    });

  const chartOptionsL = buildChartOptions(dynamicChartType, false);
  const chartOptionsR = buildChartOptions(staticChartType, true);

  return {
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
    leftAxisVisibility,
    rightAxisVisibility,
    chartOptionsL,
    chartOptionsR,
  };
}