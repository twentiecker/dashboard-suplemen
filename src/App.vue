<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";

const isGabung = ref(false);
const isMerging = ref(false);
const mergePhase = ref("idle"); // idle | lift | freeze | transfer | absorb
const mergeDuration = 1750;
const freezeDuration = 160;

const staticComponent = ref("");
const staticPeriod = ref("");
const staticMethod = ref("");

const chartStore = useChartStore();

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);

/* snapshot shards dari chart kanan asli */
const snapshotPiecesVisible = ref(false);
const snapshotPieces = ref([]);

const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtm" },
    { label: "Y on Y", value: "yoy" },
    { label: "Y to Q", value: "ytq" },
  ],
  quarterlyMethods: [
    { label: "Q to Q", value: "qtq" },
    { label: "Y on Y", value: "yoy" },
    { label: "C to C", value: "ctc" },
  ],
  staticPeriod: [
    { label: "Triwulanan", value: "quarterly" },
    { label: "Tahunan", value: "yearly" },
  ],
  staticComponents: [
    { label: "PKRT", value: "pkrt" },
    { label: "PDB", value: "pdb" },
  ],
  staticQuarterlyMethods: [
    { label: "Q to Q", value: "qtq" },
    { label: "Y on Y", value: "yoy" },
    { label: "C to C", value: "ctc" },
  ],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* =============================
 * LABEL GENERATOR
 * ============================= */
const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const generateMonthLabels = ({
  totalMonths = 24,
  monthStep = 2,
} = {}) =>
  Array.from({ length: totalMonths }, (_, i) => {
    const monthIndex = i % 12;
    return i % monthStep === 0 ? monthNames[monthIndex] : "";
  });

const generateMonthQuarterLabels = ({
  startYear = 2023,
  totalMonths = 24,
  monthStep = 2,
} = {}) =>
  Array.from({ length: totalMonths }, (_, i) => {
    const monthIndex = i % 12;
    const year = startYear + Math.floor(i / 12);
    const monthLabel = i % monthStep === 0 ? monthNames[monthIndex] : "";
    const isQuarterEnd =
      monthIndex === 2 || monthIndex === 5 || monthIndex === 8 || monthIndex === 11;

    let quarterLabel = "";
    if (isQuarterEnd) {
      const quarter = Math.floor(monthIndex / 3) + 1;
      quarterLabel = `Q${quarter} ${year}`;
    }
    return [monthLabel, quarterLabel];
  });

const generateMonthYearLabels = ({
  startYear = 2023,
  totalMonths = 24,
  monthStep = 2,
} = {}) =>
  Array.from({ length: totalMonths }, (_, i) => {
    const monthIndex = i % 12;
    const year = startYear + Math.floor(i / 12);
    const monthLabel = i % monthStep === 0 ? monthNames[monthIndex] : "";
    const yearLabel = monthIndex === 11 ? String(year) : "";
    return [monthLabel, yearLabel];
  });

const generateQuarterYearLabels = ({
  startYear = 2023,
  totalQuarters = 8,
} = {}) =>
  Array.from({ length: totalQuarters }, (_, i) => {
    const quarter = (i % 4) + 1;
    const year = startYear + Math.floor(i / 4);
    return `Q${quarter} ${year}`;
  });

const generateYearLabels = ({
  startYear = 2023,
  totalYears = 2,
} = {}) => Array.from({ length: totalYears }, (_, i) => String(startYear + i));

/* =============================
 * HELPER DUMMY DATA
 * ============================= */
const monthLabels = generateMonthLabels({
  totalMonths: 24,
  monthStep: 2,
});

const monthQuarterLabels = generateMonthQuarterLabels({
  startYear: 2023,
  totalMonths: 24,
  monthStep: 2,
});

const monthYearLabels = generateMonthYearLabels({
  startYear: 2023,
  totalMonths: 24,
  monthStep: 2,
});

const quarterYearLabels = generateQuarterYearLabels({
  startYear: 2023,
  totalQuarters: 8,
});

const yearLabels = generateYearLabels({
  startYear: 2023,
  totalYears: 2,
});

const generateMonthlySeries = (base = 100, trend = 1.2, amplitude = 8, noiseShift = 0) =>
  Array.from({ length: 24 }, (_, i) => {
    const season = Math.sin((i / 12) * Math.PI * 2) * amplitude;
    const zigzag = ((i % 4) - 1.5) * 1.2;
    const val = base + trend * i + season + zigzag + noiseShift;
    return Number(val.toFixed(2));
  });

const monthlyToQuarterly = (monthly) =>
  [
    monthly[2], monthly[5], monthly[8], monthly[11],
    monthly[14], monthly[17], monthly[20], monthly[23],
  ].map((v) => Number(v?.toFixed?.(2) ?? v));

const quarterlyToMonthly = (quarterly) => {
  const out = new Array(24).fill(null);
  const indexes = [2, 5, 8, 11, 14, 17, 20, 23];
  indexes.forEach((idx, i) => {
    out[idx] = quarterly[i] ?? null;
  });
  return out;
};

const yearlyToMonthly = (yearly) => {
  const out = new Array(24).fill(null);
  const indexes = [11, 23];
  indexes.forEach((idx, i) => {
    out[idx] = yearly[i] ?? null;
  });
  return out;
};

const yearlyToQuarterly = (yearly) => {
  const out = new Array(8).fill(null);
  const indexes = [3, 7];
  indexes.forEach((idx, i) => {
    out[idx] = yearly[i] ?? null;
  });
  return out;
};

const sumSafe = (arr) => arr.reduce((a, b) => a + Number(b ?? 0), 0);

const quarterlyToYearly = (quarterly) => {
  const result = [];
  for (let i = 0; i < quarterly.length; i += 4) {
    const chunk = quarterly.slice(i, i + 4);
    result.push(Number(sumSafe(chunk).toFixed(2)));
  }
  return result;
};

const growthPercent = (current, previous) => {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    Number(previous) === 0
  ) {
    return null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const computeMonthlyGrowth = (values, method) =>
  values.map((val, i) => {
    if (val === null || val === undefined) return null;
    if (method === "mtm") return growthPercent(val, values[i - 1]);
    if (method === "yoy") return growthPercent(val, values[i - 12]);

    if (method === "ytq") {
      if (i < 12) return null;
      const posInQuarter = i % 3;
      const quarterStart = i - posInQuarter;
      const prevYearQuarterStart = quarterStart - 12;
      if (prevYearQuarterStart < 0) return null;

      const currentCum = sumSafe(values.slice(quarterStart, i + 1));
      const prevCum = sumSafe(
        values.slice(prevYearQuarterStart, prevYearQuarterStart + posInQuarter + 1)
      );
      return growthPercent(currentCum, prevCum);
    }

    return null;
  });

const computeQuarterlyGrowth = (values, method) =>
  values.map((val, i) => {
    if (val === null || val === undefined) return null;
    if (method === "qtq") return growthPercent(val, values[i - 1]);
    if (method === "yoy") return growthPercent(val, values[i - 4]);

    if (method === "ctc") {
      if (i < 4) return null;
      const quarterPos = i % 4;
      const currentYearStart = i - quarterPos;
      const prevYearStart = currentYearStart - 4;
      if (prevYearStart < 0) return null;

      const currentCum = sumSafe(values.slice(currentYearStart, i + 1));
      const prevCum = sumSafe(values.slice(prevYearStart, prevYearStart + quarterPos + 1));
      return growthPercent(currentCum, prevCum);
    }

    return null;
  });

const getBaseSeries = (dataset, aggregation) => {
  if (aggregation === "monthly") {
    if (dataset.rawFrequency === "quarterly") {
      return quarterlyToMonthly(dataset.series.quarterly);
    }
    return dataset.series.monthly;
  }

  if (dataset.rawFrequency === "quarterly") return dataset.series.quarterly;
  return dataset.series.quarterly ?? monthlyToQuarterly(dataset.series.monthly);
};

const getPreparedSeries = (dataset, config) => {
  const measure = config?.measure ?? "nilai";
  const aggregation =
    config?.aggregation ?? (dataset.rawFrequency === "quarterly" ? "quarterly" : "monthly");
  const method = config?.method ?? (aggregation === "monthly" ? "mtm" : "qtq");

  const baseSeries = getBaseSeries(dataset, aggregation);

  if (measure === "nilai") return baseSeries;
  if (aggregation === "monthly") return computeMonthlyGrowth(baseSeries, method);
  return computeQuarterlyGrowth(baseSeries, method);
};

function createMonthlyCard({
  id,
  code,
  indicatorName,
  base,
  trend,
  amplitude,
  noiseShift = 0,
}) {
  const monthly = generateMonthlySeries(base, trend, amplitude, noiseShift);
  const quarterly = monthlyToQuarterly(monthly);

  return {
    id,
    label: code,
    indicatorName,
    groupCode: code,
    rawFrequency: "monthly",
    series: {
      monthly,
      quarterly,
    },
    tension: 0.4,
  };
}

function createQuarterlyCard({ id, code, indicatorName, quarterly }) {
  return {
    id,
    label: code,
    indicatorName,
    groupCode: code,
    rawFrequency: "quarterly",
    series: {
      quarterly,
    },
    tension: 0.4,
  };
}

/* =============================
 * DATA CARD
 * ============================= */
const cards = [
  createMonthlyCard({
    id: "1",
    code: "QA101",
    indicatorName: "Indeks Penjualan Eceran Riil Suku cadang dan aksesoris",
    base: 145,
    trend: 1.45,
    amplitude: 9,
    noiseShift: 2,
  }),
  createMonthlyCard({
    id: "2",
    code: "QA102",
    indicatorName: "Indeks Penjualan Eceran Riil Makanan, minuman, dan tembakau",
    base: 235,
    trend: -1.1,
    amplitude: 12,
    noiseShift: 3,
  }),
  createMonthlyCard({
    id: "3",
    code: "QA103",
    indicatorName: "Indeks Penjualan Eceran Riil Bahan bakar kendaraan bermotor",
    base: 118,
    trend: 0.95,
    amplitude: 8,
    noiseShift: -2,
  }),
  createMonthlyCard({
    id: "4",
    code: "QA104",
    indicatorName: "Indeks Penjualan Eceran Riil Perlengkapan rumah tangga lainnya",
    base: 86,
    trend: -0.88,
    amplitude: 7,
    noiseShift: 1,
  }),
  createMonthlyCard({
    id: "5",
    code: "QA105",
    indicatorName: "Indeks Penjualan Eceran Riil Peralatan informasi dan komunikasi",
    base: 132,
    trend: 1.3,
    amplitude: 10,
    noiseShift: 2,
  }),
  createMonthlyCard({
    id: "6",
    code: "QA106",
    indicatorName: "Indeks Penjualan Eceran Riil Barang budaya dan rekreasi",
    base: 78,
    trend: -1.15,
    amplitude: 6,
    noiseShift: 0,
  }),
  createMonthlyCard({
    id: "7",
    code: "QA107",
    indicatorName: "Indeks Penjualan Eceran Riil Tekstil dan pakaian jadi",
    base: 108,
    trend: 1.05,
    amplitude: 7.5,
    noiseShift: 1.5,
  }),
  createMonthlyCard({
    id: "8",
    code: "QA108",
    indicatorName: "Indeks Penjualan Eceran Riil Barang farmasi, kosmetik, dan kesehatan",
    base: 168,
    trend: -1.18,
    amplitude: 5.2,
    noiseShift: 1,
  }),
  createQuarterlyCard({
    id: "9",
    code: "QB201",
    indicatorName: "Indeks Keyakinan Konsumen Triwulanan",
    quarterly: [102.2, 104.8, 106.1, 107.3, 108.2, 109.4, 110.1, 111.7],
  }),
  createQuarterlyCard({
    id: "10",
    code: "QB202",
    indicatorName: "Indikator Kinerja Distribusi Triwulanan",
    quarterly: [84.6, 83.2, 82.1, 80.7, 79.8, 78.3, 76.9, 75.4],
  }),
  createQuarterlyCard({
    id: "11",
    code: "QB203",
    indicatorName: "Indikator Optimisme Usaha Triwulanan",
    quarterly: [91.5, 93.1, 94.4, 95.7, 97.2, 98.8, 100.1, 101.4],
  }),
  createQuarterlyCard({
    id: "12",
    code: "QB204",
    indicatorName: "Indeks Sentimen Sektor Riil Triwulanan",
    quarterly: [73.5, 72.4, 71.2, 70.1, 68.9, 67.8, 66.1, 64.7],
  }),
];

onMounted(() => {
  chartStore.initPrimary(cards[0]);
});

/* =============================
 * RIGHT FILTER BERTAHAP
 * ============================= */
watch(staticComponent, (val) => {
  if (!val) {
    staticPeriod.value = "";
    staticMethod.value = "";
    return;
  }
  if (!staticPeriod.value) {
    staticPeriod.value = "quarterly";
  }
});

watch(staticPeriod, (val) => {
  if (!val) {
    staticMethod.value = "";
    return;
  }
  if (val === "quarterly") {
    if (!staticMethod.value) {
      staticMethod.value = "qtq";
    }
  } else {
    staticMethod.value = "";
  }
});

const showStaticPeriodFilter = computed(() => !!staticComponent.value);
const showStaticMethodFilter = computed(
  () => !!staticComponent.value && staticPeriod.value === "quarterly"
);

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
const staticDatasetMap = {
  pkrt: {
    id: "static-pkrt",
    label: "PKRT",
    frequency: "quarterly",
    rawFrequency: "quarterly",
    indicatorName: "PKRT",
    series: {
      quarterly: [22, 52, 13, 41, 34, 61, 45, 58],
    },
    tension: 0.4,
    isStatic: true,
  },
  pdb: {
    id: "static-pdb",
    label: "PDB",
    frequency: "quarterly",
    rawFrequency: "quarterly",
    indicatorName: "PDB",
    series: {
      quarterly: [31, 48, 28, 44, 39, 57, 53, 66],
    },
    tension: 0.4,
    isStatic: true,
  },
};

const activeStaticDataset = computed(() => staticDatasetMap[staticComponent.value] ?? null);
const staticSeriesBase = computed(() => activeStaticDataset.value?.series?.quarterly ?? []);

const staticSeriesPrepared = computed(() => {
  if (!activeStaticDataset.value || !staticPeriod.value) return [];

  if (staticPeriod.value === "yearly") {
    return quarterlyToYearly(staticSeriesBase.value);
  }

  if (staticMethod.value) {
    return computeQuarterlyGrowth(staticSeriesBase.value, staticMethod.value);
  }

  return staticSeriesBase.value;
});

/* =============================
 * FILTER ATAS CHART KIRI
 * ============================= */
const primaryDataset = computed(() => chartStore.selectedDataset?.[0] ?? null);

const primaryRawConfig = computed(() => {
  if (!primaryDataset.value) return null;
  const id = String(primaryDataset.value.id);
  return chartStore.compareConfigs[id] ?? null;
});

const primaryMeasure = computed(() => primaryRawConfig.value?.measure ?? null);
const primaryAggregation = computed(() => primaryRawConfig.value?.aggregation ?? null);
const primaryMethod = computed(() => primaryRawConfig.value?.method ?? null);

const showPrimaryAggregationFilter = computed(() => !!primaryMeasure.value);
const showPrimaryMethodFilter = computed(
  () => !!primaryMeasure.value && !!primaryAggregation.value
);

const canChoosePrimaryMonthly = computed(() => primaryDataset.value?.rawFrequency === "monthly");

const onPrimaryMeasureChange = (e) => {
  if (!primaryDataset.value) return;
  chartStore.setMeasure(primaryDataset.value.id, e.target.value, primaryDataset.value);
};

const onPrimaryAggregationChange = (e) => {
  if (!primaryDataset.value) return;
  chartStore.setAggregation(primaryDataset.value.id, e.target.value, primaryDataset.value);
};

const onPrimaryMethodChange = (e) => {
  if (!primaryDataset.value) return;
  chartStore.setMethod(primaryDataset.value.id, e.target.value, primaryDataset.value);
};

/* =============================
 * AGGREGATION PER DATASET
 * ============================= */
const getEffectiveAggregation = (dataset) => {
  const id = String(dataset.id);
  const rawConfig = chartStore.compareConfigs[id] ?? null;

  return rawConfig?.aggregation ??
    (dataset.rawFrequency === "quarterly" ? "quarterly" : "monthly");
};

/* =============================
 * GABUNGKAN DISABLE RULE
 * ============================= */
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

const isCombineDisabled = computed(() => combineTargetAxisLevels.value > 2);

const combineDisabledMessage = computed(() => {
  if (!isCombineDisabled.value) return "";
  return "Fitur gabungkan dinonaktifkan karena kombinasi filter ini membutuhkan 3 baris label sumbu X, sedangkan maksimum hanya 2 baris.";
});

/* =============================
 * MIXED DETECTION
 * ============================= */
const hasMonthlyQuarterlyMixed = computed(() => {
  const selected = chartStore.selectedDataset;
  if (!selected.length) return false;

  const aggregations = selected.map((ds) => getEffectiveAggregation(ds));
  const hasMonthly = aggregations.includes("monthly");
  const hasQuarterly = aggregations.includes("quarterly");
  const includeStaticQuarterly =
    isGabung.value &&
    !!staticComponent.value &&
    staticPeriod.value === "quarterly";

  return (hasMonthly && hasQuarterly) || (hasMonthly && includeStaticQuarterly);
});

const hasMonthlyYearlyCombined = computed(() => {
  if (!isGabung.value) return false;
  if (!staticComponent.value) return false;
  if (staticPeriod.value !== "yearly") return false;

  const selected = chartStore.selectedDataset;
  if (!selected.length) return false;

  const hasMonthly = selected.some((ds) => getEffectiveAggregation(ds) === "monthly");
  const hasQuarterly = selected.some((ds) => getEffectiveAggregation(ds) === "quarterly");

  return hasMonthly && !hasQuarterly;
});

const hasQuarterlyYearlyCombined = computed(() => {
  if (!isGabung.value) return false;
  if (!staticComponent.value) return false;
  if (staticPeriod.value !== "yearly") return false;

  const selected = chartStore.selectedDataset;
  if (!selected.length) return false;

  const hasQuarterly = selected.some((ds) => getEffectiveAggregation(ds) === "quarterly");
  const hasMonthly = selected.some((ds) => getEffectiveAggregation(ds) === "monthly");

  return hasQuarterly && !hasMonthly;
});

/* =============================
 * AXIS LEFT
 * ============================= */
const leftAxisMode = computed(() => {
  if (hasMonthlyQuarterlyMixed.value) return "monthly-quarterly-mixed";
  if (hasMonthlyYearlyCombined.value) return "monthly-yearly-mixed";
  if (hasQuarterlyYearlyCombined.value) return "quarterly-yearly-mixed";
  if (!primaryDataset.value) return "monthly";
  return getEffectiveAggregation(primaryDataset.value);
});

const leftXAxisLabels = computed(() => {
  if (leftAxisMode.value === "monthly-quarterly-mixed") return monthQuarterLabels;
  if (leftAxisMode.value === "monthly-yearly-mixed") return monthYearLabels;
  if (leftAxisMode.value === "quarterly-yearly-mixed") return quarterYearLabels;
  if (leftAxisMode.value === "quarterly") return quarterYearLabels;
  return monthLabels;
});

/* =============================
 * RIGHT CHART LABELS / DATA
 * ============================= */
const rightXAxisLabels = computed(() => {
  if (!staticComponent.value || !staticPeriod.value) return [];
  return staticPeriod.value === "yearly" ? yearLabels : quarterYearLabels;
});

/* =============================
 * CHART DATA LEFT
 * ============================= */
const chartDataL = computed(() => {
  const axisMode = leftAxisMode.value;

  const dyn = chartStore.selectedDataset.map((ds, idx) => {
    const colors = palette[idx] ?? palette[0];
    const config = chartStore.getCompareConfig(ds);
    const dsAggregation = getEffectiveAggregation(ds);
    const prepared = getPreparedSeries(ds, config);

    let plottedData = prepared;

    if (axisMode === "monthly-quarterly-mixed") {
      plottedData = dsAggregation === "quarterly" ? quarterlyToMonthly(prepared) : prepared;
    } else if (axisMode === "quarterly") {
      plottedData = dsAggregation === "monthly" ? monthlyToQuarterly(prepared) : prepared;
    } else if (axisMode === "quarterly-yearly-mixed") {
      plottedData = dsAggregation === "monthly" ? monthlyToQuarterly(prepared) : prepared;
    }

    return {
      label: ds.indicatorName,
      data: plottedData,
      fill: true,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      tension: 0.4,
      cubicInterpolationMode: "monotone",
      yAxisID: "y",
      xAxisID: "x",
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
    };
  });

  if (isGabung.value && activeStaticDataset.value && staticPeriod.value) {
    let staticAligned = staticSeriesBase.value;

    if (staticPeriod.value === "yearly") {
      const yearlySeries = quarterlyToYearly(staticSeriesBase.value);

      if (axisMode === "monthly-yearly-mixed" || axisMode === "monthly") {
        staticAligned = yearlyToMonthly(yearlySeries);
      } else if (axisMode === "quarterly-yearly-mixed" || axisMode === "quarterly") {
        staticAligned = yearlyToQuarterly(yearlySeries);
      } else {
        staticAligned = yearlySeries;
      }
    } else {
      const staticPreparedForCombine = staticMethod.value
        ? computeQuarterlyGrowth(staticSeriesBase.value, staticMethod.value)
        : staticSeriesBase.value;

      if (axisMode === "monthly-quarterly-mixed" || axisMode === "monthly") {
        staticAligned = quarterlyToMonthly(staticPreparedForCombine);
      } else {
        staticAligned = staticPreparedForCombine;
      }
    }

    dyn.push({
      label: activeStaticDataset.value.indicatorName,
      data: staticAligned,
      fill: true,
      borderColor: theme.value.primary,
      backgroundColor: "rgba(16, 185, 129, 0.18)",
      tension: 0.4,
      cubicInterpolationMode: "monotone",
      yAxisID: "y1",
      xAxisID: "x",
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
      isStatic: true,
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
  datasets:
    activeStaticDataset.value && staticPeriod.value
      ? [
          {
            ...activeStaticDataset.value,
            label: activeStaticDataset.value.indicatorName,
            data: staticSeriesPrepared.value,
            fill: true,
            borderColor: theme.value.primary,
            backgroundColor: "rgba(16, 185, 129, 0.18)",
            tension: 0.4,
            cubicInterpolationMode: "monotone",
            yAxisID: "y",
            xAxisID: "x",
            pointRadius: 3,
            pointHoverRadius: 5,
            isStatic: true,
          },
        ]
      : [],
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
        ctx.fillText(Number(val).toFixed(2), point.x, point.y - 6);
        ctx.restore();
      });
    });
  },
};

/* =============================
 * SNAPSHOT SHARDS DARI CHART KANAN ASLI
 * ============================= */
const buildSnapshotPieces = async () => {
  await nextTick();

  const canvas = rightPanelRef.value?.querySelector("canvas");
  const leftBox = leftPanelRef.value?.getBoundingClientRect();

  if (!canvas || !leftBox) {
    snapshotPieces.value = [];
    return false;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const dataUrl = canvas.toDataURL("image/png");

  const cols = 6;
  const rows = 4;
  const pieceW = canvasRect.width / cols;
  const pieceH = canvasRect.height / rows;

  const targetX = leftBox.left + leftBox.width * 0.28;
  const targetY = leftBox.top + leftBox.height * 0.42;

  const pieces = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;

      const startLeft = canvasRect.left + col * pieceW;
      const startTop = canvasRect.top + row * pieceH;

      const destLeft = targetX + (Math.random() * 120 - 60);
      const destTop = targetY + (Math.random() * 70 - 35);

      const dx = destLeft - startLeft;
      const dy = destTop - startTop;

      const arc = -(60 + Math.random() * 90);
      const rot = `${-90 + Math.random() * 180}deg`;
      const scale = (0.2 + Math.random() * 0.35).toFixed(2);
      const delay = `${index * 18}ms`;

      pieces.push({
        id: `piece-${index}`,
        style: {
          left: `${startLeft}px`,
          top: `${startTop}px`,
          width: `${pieceW + 0.5}px`,
          height: `${pieceH + 0.5}px`,
          backgroundImage: `url("${dataUrl}")`,
          backgroundSize: `${canvasRect.width}px ${canvasRect.height}px`,
          backgroundPosition: `-${col * pieceW}px -${row * pieceH}px`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          "--arc": `${arc}px`,
          "--rot": rot,
          "--scale": scale,
          "--delay": delay,
        },
      });
    }
  }

  snapshotPieces.value = pieces;
  return true;
};

/* =============================
 * TOGGLE GABUNG DENGAN ANIMASI
 * ============================= */
const onToggleGabung = async () => {
  if (isCombineDisabled.value) return;

  if (isGabung.value) {
    isMerging.value = true;
    mergePhase.value = "absorb";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    isGabung.value = false;
    await wait(700);
    mergePhase.value = "idle";
    isMerging.value = false;
    snapshotPiecesVisible.value = false;
    snapshotPieces.value = [];
    return;
  }

  isMerging.value = true;

  mergePhase.value = "lift";
  await wait(240);

  mergePhase.value = "freeze";
  await wait(freezeDuration);

  await buildSnapshotPieces();
  snapshotPiecesVisible.value = true;

  mergePhase.value = "transfer";
  await wait(620);

  isGabung.value = true;

  await nextTick();
  mergePhase.value = "absorb";
  await wait(520);

  snapshotPiecesVisible.value = false;
  snapshotPieces.value = [];
  mergePhase.value = "idle";
  isMerging.value = false;
};

/* =============================
 * CHART OPTIONS
 * ============================= */
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 900,
    easing: "easeInOutQuart",
  },
  animations: {
    x: {
      duration: 900,
      easing: "easeInOutQuart",
    },
    y: {
      duration: 900,
      easing: "easeInOutQuart",
    },
    tension: {
      duration: 900,
      easing: "easeInOutQuart",
    },
    radius: {
      duration: 900,
      easing: "easeInOutQuart",
    },
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
        autoSkip: false,
        callback(value) {
          const label = this.getLabelForValue(value);
          return Array.isArray(label) ? label : [label];
        },
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
      display: isGabung.value && !!staticComponent.value && !!staticPeriod.value,
      ticks: { color: theme.value.textSecondary },
      grid: { drawOnChartArea: false },
    },
  },
}));
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden">
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
        />
      </div>
    </div>

    <div class="flex-8 h-full overflow-hidden">
      <div class="p-4 h-full overflow-auto">
        <Button
          :label="isGabung ? 'Pisahkan' : 'Gabungkan'"
          :outlined="!isGabung"
          rounded
          :disabled="isCombineDisabled"
          @click="onToggleGabung"
        />

        <p
          v-if="isCombineDisabled"
          class="mt-2 text-[12px] text-amber-400"
        >
          {{ combineDisabledMessage }}
        </p>

        <div
          class="charts-shell flex gap-3 mt-3 items-start"
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
            class="left-chart-panel flex-1 min-w-0"
            :class="{
              'merge-absorb': isMerging && mergePhase === 'absorb'
            }"
          >
            <div class="mb-3 rounded-lg border p-3 theme-filter-panel">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[12px] mb-1 theme-text-muted">Pilih Tampilan</label>
                  <select
                    class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                    :value="primaryMeasure ?? ''"
                    @change="onPrimaryMeasureChange"
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
                  <label class="block text-[12px] mb-1 theme-text-muted">Pilih Frekuensi</label>
                  <select
                    class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                    :value="primaryAggregation ?? ''"
                    @change="onPrimaryAggregationChange"
                  >
                    <option value="" disabled>Pilih frekuensi</option>
                    <option value="monthly" :disabled="!canChoosePrimaryMonthly">Bulanan</option>
                    <option value="quarterly">Triwulanan</option>
                  </select>
                </div>

                <div v-if="showPrimaryMethodFilter && primaryAggregation === 'monthly'">
                  <label class="block text-[12px] mb-1 theme-text-muted">Metode Bulanan</label>
                  <select
                    class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                    :value="primaryMethod ?? ''"
                    @change="onPrimaryMethodChange"
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
                  <label class="block text-[12px] mb-1 theme-text-muted">Metode Triwulanan</label>
                  <select
                    class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                    :value="primaryMethod ?? ''"
                    @change="onPrimaryMethodChange"
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
              </div>
            </div>

            <Chart
              type="line"
              :data="chartDataL"
              :options="chartOptions"
              :plugins="[valueLabelPlugin]"
              class="h-120 chart-left-dynamic"
            />
          </div>

          <Transition name="merge-right-panel">
            <div
              v-if="!isGabung"
              ref="rightPanelRef"
              class="right-chart-panel flex-1 basis-1/2 min-w-0"
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

              <div class="mb-3 rounded-lg border p-3 theme-filter-panel">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[12px] mb-1 theme-text-muted">Component</label>
                    <select
                      class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                      v-model="staticComponent"
                    >
                      <option value="" disabled>Pilih component</option>
                      <option
                        v-for="opt in FILTER_OPTIONS.staticComponents"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-if="showStaticPeriodFilter">
                    <label class="block text-[12px] mb-1 theme-text-muted">Periode Chart Statistik</label>
                    <select
                      class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                      v-model="staticPeriod"
                    >
                      <option value="" disabled>Pilih periode</option>
                      <option
                        v-for="opt in FILTER_OPTIONS.staticPeriod"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>

                  <div v-if="showStaticMethodFilter">
                    <label class="block text-[12px] mb-1 theme-text-muted">Metode Triwulan</label>
                    <select
                      class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                      v-model="staticMethod"
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
                </div>
              </div>

              <Chart
                type="line"
                :data="chartDataR"
                :options="chartOptions"
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

/* layout */
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

/* right panel */
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

/* cinematic fx */
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

/* snapshot shards dari chart kanan asli */
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
</style>