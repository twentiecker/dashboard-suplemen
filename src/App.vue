<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";
import { fetchPkrtIndicators, buildDatasetFromApi } from "./services/pkrtAPI";

const isGabung = ref(false);
const isMerging = ref(false);
const mergePhase = ref("idle");
const freezeDuration = 160;

const staticComponent = ref("");
const staticPeriod = ref("");
const staticMethod = ref("");

const dynamicChartType = ref("line");
const staticChartType = ref("line");

const chartStore = useChartStore();

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);

const snapshotPiecesVisible = ref(false);
const snapshotPieces = ref([]);

const cards = ref([]);
const isLoadingCards = ref(false);

const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtm" },
    { label: "Y on Y", value: "yoy" },
    { label: "Y to D", value: "ytd" },
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
  staticQuarterlyMethods: [
    { label: "Q to Q", value: "qtq" },
    { label: "Y on Y", value: "yoy" },
    { label: "C to C", value: "ctc" },
  ],
  chartTypes: [
    { label: "Line Chart", value: "line" },
    { label: "Bar Chart", value: "bar" },
  ],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const parsePeriod = (period) => {
  const text = String(period ?? "").trim().toUpperCase();

  let m = text.match(/^(\d{4})M(\d{1,2})$/);
  if (m) {
    return {
      raw: text,
      type: "monthly",
      year: Number(m[1]),
      month: Number(m[2]),
      quarter: Math.ceil(Number(m[2]) / 3),
      order: Number(m[1]) * 100 + Number(m[2]),
    };
  }

  m = text.match(/^(\d{4})Q([1-4])$/);
  if (m) {
    return {
      raw: text,
      type: "quarterly",
      year: Number(m[1]),
      quarter: Number(m[2]),
      month: Number(m[2]) * 3,
      order: Number(m[1]) * 10 + Number(m[2]),
    };
  }

  m = text.match(/^(\d{4})$/);
  if (m) {
    return {
      raw: text,
      type: "yearly",
      year: Number(m[1]),
      order: Number(m[1]),
    };
  }

  return {
    raw: text,
    type: "unknown",
    year: null,
    month: null,
    quarter: null,
    order: Number.MAX_SAFE_INTEGER,
  };
};

const formatYearTick = (period) => {
  const p = parsePeriod(period);
  return p.year ? String(p.year) : String(period ?? "");
};

const formatTooltipPeriod = (period, aggregationHint = "") => {
  const p = parsePeriod(period);

  if (p.type === "monthly") return `${monthNames[p.month - 1]} ${p.year}`;
  if (p.type === "quarterly") return `Q${p.quarter} ${p.year}`;
  if (p.type === "yearly") return String(p.year);

  if (aggregationHint === "monthly") return String(period ?? "");
  if (aggregationHint === "quarterly") return String(period ?? "");
  if (aggregationHint === "yearly") return String(period ?? "");

  return String(period ?? "");
};

const isQuarterEndPeriod = (period) => {
  const p = parsePeriod(period);
  return p.type === "monthly" && [3, 6, 9, 12].includes(p.month);
};

const monthPeriodToQuarterPeriod = (period) => {
  const p = parsePeriod(period);
  if (p.type !== "monthly") return null;
  return `${p.year}Q${p.quarter}`;
};

const getMonthLabelStep = (count) => {
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  if (count <= 36) return 3;
  if (count <= 60) return 4;
  if (count <= 96) return 6;
  return 12;
};

const getQuarterLabelStep = (count) => {
  if (count <= 12) return 1;
  if (count <= 20) return 2;
  if (count <= 32) return 3;
  if (count <= 48) return 4;
  return 6;
};

const buildMonthlyTickLabel = (period, index, totalCount, mode = "default") => {
  const parsed = parsePeriod(period);
  if (parsed.type !== "monthly") return "";

  const step = getMonthLabelStep(totalCount);
  if (index % step !== 0) return "";

  const monthLabel = monthNames[parsed.month - 1] ?? "";

  if (mode === "ytd") {
    if (parsed.month === 1) return [monthLabel, String(parsed.year)];
    return monthLabel;
  }

  if (parsed.month === 1 && totalCount > 12) {
    return [monthLabel, String(parsed.year)];
  }

  return monthLabel;
};

const buildQuarterlyTickLabel = (period, index, totalCount, forceShowAll = false) => {
  const parsed = parsePeriod(period);
  if (parsed.type !== "quarterly") return "";

  if (!forceShowAll) {
    const step = getQuarterLabelStep(totalCount);
    if (index % step !== 0) return "";
  }

  return `Q${parsed.quarter} ${parsed.year}`;
};

const sumSafe = (arr) => arr.reduce((a, b) => a + Number(b ?? 0), 0);

const monthlyToQuarterlyByPeriods = (monthly = [], periods = []) => {
  const data = [];
  const outPeriods = [];

  periods.forEach((period, index) => {
    if (isQuarterEndPeriod(period)) {
      data.push(monthly[index] ?? null);
      outPeriods.push(monthPeriodToQuarterPeriod(period));
    }
  });

  return { data, periods: outPeriods };
};

const quarterlyToYearlyByPeriods = (quarterly = [], periods = []) => {
  const bucket = new Map();

  periods.forEach((period, index) => {
    const parsed = parsePeriod(period);
    if (!parsed.year) return;

    if (!bucket.has(parsed.year)) bucket.set(parsed.year, []);
    bucket.get(parsed.year).push(quarterly[index] ?? null);
  });

  const years = [...bucket.keys()].sort((a, b) => a - b);
  const data = years.map((year) => Number(sumSafe(bucket.get(year)).toFixed(2)));
  const outPeriods = years.map(String);

  return { data, periods: outPeriods };
};

const getSeriesMeta = (dataset, aggregation) => {
  const monthlyPeriods = Array.isArray(dataset?.derivedPeriods?.monthly)
    ? dataset.derivedPeriods.monthly
    : Array.isArray(dataset?.periods)
      ? dataset.periods
      : [];

  const quarterlyPeriods = Array.isArray(dataset?.derivedPeriods?.quarterly)
    ? dataset.derivedPeriods.quarterly
    : dataset?.rawFrequency === "quarterly"
      ? (Array.isArray(dataset?.periods) ? dataset.periods : [])
      : monthlyToQuarterlyByPeriods(dataset?.series?.monthly ?? [], monthlyPeriods).periods;

  if (aggregation === "monthly") {
    return {
      data: dataset?.series?.monthly ?? [],
      periods: monthlyPeriods,
      aggregation: "monthly",
    };
  }

  if (aggregation === "quarterly") {
    return {
      data: dataset?.series?.quarterly ?? [],
      periods: quarterlyPeriods,
      aggregation: "quarterly",
    };
  }

  if (aggregation === "yearly") {
    const yearlyMeta = quarterlyToYearlyByPeriods(dataset?.series?.quarterly ?? [], quarterlyPeriods);
    return {
      data: yearlyMeta.data,
      periods: yearlyMeta.periods,
      aggregation: "yearly",
    };
  }

  return {
    data: [],
    periods: [],
    aggregation,
  };
};

const getBackendGrowthMeta = (dataset, aggregation, method, fallbackPeriods = []) => {
  const payload = dataset?.growth?.[aggregation]?.[method];

  if (Array.isArray(payload)) {
    return {
      data: payload,
      periods: fallbackPeriods,
      aggregation,
    };
  }

  if (payload && typeof payload === "object") {
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      periods: Array.isArray(payload.periods) ? payload.periods : fallbackPeriods,
      aggregation,
    };
  }

  return {
    data: [],
    periods: fallbackPeriods,
    aggregation,
  };
};

const getPreparedSeriesMeta = (dataset, config) => {
  const measure = config?.measure ?? "nilai";
  const aggregation =
    config?.aggregation ?? (dataset.rawFrequency === "quarterly" ? "quarterly" : "monthly");
  const method = config?.method ?? (aggregation === "monthly" ? "mtm" : "qtq");

  const baseMeta = getSeriesMeta(dataset, aggregation);

  if (measure === "nilai") return baseMeta;

  return getBackendGrowthMeta(dataset, aggregation, method, baseMeta.periods);
};

const toPointData = (meta) =>
  meta.periods.map((period, index) => ({
    x: period,
    y: meta.data[index] ?? null,
  }));

const dedupePeriods = (periods = []) =>
  [...new Set(periods.filter(Boolean))].sort((a, b) => {
    const pa = parsePeriod(a);
    const pb = parsePeriod(b);
    return pa.order - pb.order;
  });

const aggregationToAxisId = (aggregation) => {
  if (aggregation === "monthly") return "xMonthly";
  if (aggregation === "quarterly") return "xQuarterly";
  if (aggregation === "yearly") return "xYearly";
  return "xMonthly";
};

const loadCardsFromApi = async () => {
  try {
    isLoadingCards.value = true;

    const indikator = await fetchPkrtIndicators();

    const datasets = await Promise.all(
      indikator.map((item) =>
        buildDatasetFromApi({
          kode: item.kode,
          deskripsi: item.deskripsi,
        })
      )
    );

    const validDatasets = datasets.filter((item) => item && item.id);
    cards.value = validDatasets;

    if (validDatasets.length) {
      chartStore.initPrimary(validDatasets[0]);
      staticComponent.value = validDatasets[0].id;
    }
  } catch (err) {
    console.error("Gagal load PKRT data", err);
    cards.value = [];
  } finally {
    isLoadingCards.value = false;
  }
};

onMounted(async () => {
  await loadCardsFromApi();
});

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
    if (!staticMethod.value) staticMethod.value = "qtq";
  } else {
    staticMethod.value = "";
  }
});

const showStaticPeriodFilter = computed(() => !!staticComponent.value);
const showStaticMethodFilter = computed(
  () => !!staticComponent.value && staticPeriod.value === "quarterly"
);

const theme = computed(() => {
  const style = getComputedStyle(document.documentElement);
  return {
    primary: style.getPropertyValue("--p-primary-500").trim(),
    text: style.getPropertyValue("--p-text-color").trim(),
    textSecondary: style.getPropertyValue("--p-text-muted-color").trim(),
    border: style.getPropertyValue("--p-content-border-color").trim(),
  };
});

const palette = [
  { line: "#3B82F6", fill: "rgba(59,130,246,0.45)" },
  { line: "#F59E0B", fill: "rgba(245,158,11,0.45)" },
  { line: "#A855F7", fill: "rgba(168,85,247,0.45)" },
  { line: "#22C55E", fill: "rgba(34,197,94,0.45)" },
  { line: "#EF4444", fill: "rgba(239,68,68,0.45)" },
];

const staticComponentOptions = computed(() =>
  cards.value.map((item) => ({
    label: `${item.groupCode} - ${item.indicatorName}`,
    value: item.id,
  }))
);

const staticDatasetMap = computed(() => {
  const map = {};
  cards.value.forEach((item) => {
    map[item.id] = { ...item, isStatic: true };
  });
  return map;
});

const activeStaticDataset = computed(() => staticDatasetMap.value[staticComponent.value] ?? null);

const staticSeriesMeta = computed(() => {
  if (!activeStaticDataset.value || !staticPeriod.value) {
    return { data: [], periods: [], aggregation: "quarterly" };
  }

  if (staticPeriod.value === "yearly") {
    return getSeriesMeta(activeStaticDataset.value, "yearly");
  }

  if (staticMethod.value) {
    const baseQuarterMeta = getSeriesMeta(activeStaticDataset.value, "quarterly");
    return getBackendGrowthMeta(
      activeStaticDataset.value,
      "quarterly",
      staticMethod.value,
      baseQuarterMeta.periods
    );
  }

  return getSeriesMeta(activeStaticDataset.value, "quarterly");
});

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
  () => primaryMeasure.value === "pertumbuhan" && !!primaryAggregation.value
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

const getEffectiveAggregation = (dataset) => {
  const id = String(dataset.id);
  const rawConfig = chartStore.compareConfigs[id] ?? null;

  return rawConfig?.aggregation ??
    (dataset.rawFrequency === "quarterly" ? "quarterly" : "monthly");
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

const isCombineDisabled = computed(() => combineTargetAxisLevels.value > 2);

const combineDisabledMessage = computed(() => {
  if (!isCombineDisabled.value) return "";
  return "Fitur gabungkan dinonaktifkan karena kombinasi filter ini membutuhkan 3 sumbu X sekaligus, sedangkan maksimum hanya 2.";
});

const leftPreparedDynamicSeries = computed(() =>
  chartStore.selectedDataset.map((ds) => {
    const idx = chartStore.selectedDataset.findIndex((item) => item.id === ds.id);
    const colors = palette[idx] ?? palette[0];
    const config = chartStore.getCompareConfig(ds);
    const meta = getPreparedSeriesMeta(ds, config);

    return {
      dataset: ds,
      meta,
      aggregation: meta.aggregation,
      colors,
    };
  })
);

const hasMonthlySeriesLeft = computed(() =>
  leftPreparedDynamicSeries.value.some((item) => item.aggregation === "monthly")
);

const hasQuarterlySeriesLeft = computed(() => {
  if (leftPreparedDynamicSeries.value.some((item) => item.aggregation === "quarterly")) return true;
  return isGabung.value && !!activeStaticDataset.value && staticPeriod.value === "quarterly";
});

const hasYearlySeriesLeft = computed(() =>
  isGabung.value && !!activeStaticDataset.value && staticPeriod.value === "yearly"
);

const isMixedMonthlyQuarterlyAxis = computed(() =>
  hasMonthlySeriesLeft.value && hasQuarterlySeriesLeft.value && !hasYearlySeriesLeft.value
);

const leftMonthlyAxisPeriods = computed(() => {
  const periods = [];
  leftPreparedDynamicSeries.value.forEach((item) => {
    if (item.aggregation === "monthly") periods.push(...item.meta.periods);
  });
  return dedupePeriods(periods);
});

const leftQuarterlyAxisPeriods = computed(() => {
  const periods = [];
  leftPreparedDynamicSeries.value.forEach((item) => {
    if (item.aggregation === "quarterly") periods.push(...item.meta.periods);
  });

  if (isGabung.value && activeStaticDataset.value && staticPeriod.value === "quarterly") {
    periods.push(...staticSeriesMeta.value.periods);
  }

  return dedupePeriods(periods);
});

const leftYearlyAxisPeriods = computed(() => {
  const periods = [];
  if (isGabung.value && activeStaticDataset.value && staticPeriod.value === "yearly") {
    periods.push(...staticSeriesMeta.value.periods);
  }
  return dedupePeriods(periods);
});

const createDatasetTooltipMeta = ({
  periods = [],
  sourceAggregation = "",
}) => {
  return {
    tooltipPeriods: periods,
    sourceAggregation,
  };
};

const getTooltipPeriodForContext = (context) => {
  const dataset = context?.dataset ?? {};
  const dataIndex = context?.dataIndex ?? -1;
  const tooltipPeriods = dataset.tooltipPeriods ?? [];

  return tooltipPeriods[dataIndex] ?? context?.raw?.x ?? null;
};

const getTooltipAggregationForContext = (context) => {
  return context?.dataset?.sourceAggregation ?? "";
};

const buildDatasetStyle = ({
  chartType = "line",
  lineColor = "#3B82F6",
  fillColor = "rgba(59,130,246,0.18)",
  yAxisID = "y",
  xAxisID = "xMonthly",
  isStatic = false,
}) => {
  if (chartType === "bar") {
    return {
      type: "bar",
      backgroundColor: fillColor,
      borderColor: lineColor,
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 34,
      categoryPercentage: 0.72,
      barPercentage: 0.82,
      yAxisID,
      xAxisID,
      isStatic,
    };
  }

  return {
    type: "line",
    fill: false,
    borderColor: lineColor,
    backgroundColor: fillColor,
    tension: 0.35,
    cubicInterpolationMode: "monotone",
    yAxisID,
    xAxisID,
    pointRadius: 3,
    pointHoverRadius: 5,
    spanGaps: true,
    isStatic,
  };
};

const chartDataL = computed(() => {
  const dyn = leftPreparedDynamicSeries.value.map((item) => {
    const tooltipMeta = createDatasetTooltipMeta({
      periods: item.meta.periods,
      sourceAggregation: item.aggregation,
    });

    return {
      label: item.dataset.indicatorName,
      data: toPointData(item.meta),
      ...tooltipMeta,
      ...buildDatasetStyle({
        chartType: dynamicChartType.value,
        lineColor: item.colors.line,
        fillColor: item.colors.fill,
        yAxisID: "y",
        xAxisID: aggregationToAxisId(item.aggregation),
        isStatic: false,
      }),
    };
  });

  if (isGabung.value && activeStaticDataset.value && staticPeriod.value) {
    const staticAggregation = staticPeriod.value === "yearly" ? "yearly" : "quarterly";

    dyn.push({
      label: activeStaticDataset.value.indicatorName,
      data: toPointData(staticSeriesMeta.value),
      ...createDatasetTooltipMeta({
        periods: staticSeriesMeta.value.periods,
        sourceAggregation: staticAggregation,
      }),
      ...buildDatasetStyle({
        chartType: dynamicChartType.value,
        lineColor: theme.value.primary || "#10B981",
        fillColor: "rgba(16, 185, 129, 0.45)",
        yAxisID: "y1",
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
            label: activeStaticDataset.value.indicatorName,
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
      if (dataset?.isStatic) return;
      if (datasetIndex !== 0) return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, i) => {
        const raw = dataset.data[i];
        const val = raw?.y;

        if (val === null || val === undefined) return;

        const x = element?.x;
        const y = element?.y;
        if (x === undefined || y === undefined) return;

        ctx.save();
        ctx.font = "11px sans-serif";
        ctx.fillStyle = theme.value.text || "#E5E7EB";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(Number(val).toFixed(2), x, y - 6);
        ctx.restore();
      });
    });
  },
};

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

const leftAxisVisibility = computed(() => ({
  monthly: hasMonthlySeriesLeft.value,
  quarterly: hasQuarterlySeriesLeft.value,
  yearly: hasYearlySeriesLeft.value,
}));

const rightAxisVisibility = computed(() => ({
  monthly: false,
  quarterly: staticPeriod.value === "quarterly",
  yearly: staticPeriod.value === "yearly",
}));

const activeMonthlyMethod = computed(() => {
  if (primaryMeasure.value !== "pertumbuhan" || primaryAggregation.value !== "monthly") return "";
  return primaryMethod.value ?? "";
});

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
                    return formatTooltipPeriod(period, aggregation);
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
              const formattedPeriod = formatTooltipPeriod(tooltipPeriod, aggregation);

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
          title: {
            display: false,
          },
        },
        xQuarterly: {
          type: "category",
          position: "bottom",
          display: axisVisibility.quarterly,
          offset: chartTypeRef.value === "bar",
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
        y: {
          position: "left",
          beginAtZero: false,
          ticks: { color: theme.value.textSecondary },
          grid: { color: theme.value.border },
        },
        y1: {
          position: "right",
          beginAtZero: false,
          display: !isRightChart && isGabung.value && !!staticComponent.value && !!staticPeriod.value,
          ticks: { color: theme.value.textSecondary },
          grid: { drawOnChartArea: false },
        },
      },
    };
  });

const chartOptionsL = buildChartOptions(dynamicChartType, false);
const chartOptionsR = buildChartOptions(staticChartType, true);
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
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
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

                <div>
                  <label class="block text-[12px] mb-1 theme-text-muted">Tipe Chart Dinamis</label>
                  <select
                    class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                    v-model="dynamicChartType"
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
            </div>

            <Chart
              :type="dynamicChartType"
              :data="chartDataL"
              :options="chartOptionsL"
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
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label class="block text-[12px] mb-1 theme-text-muted">Komponen PKRT</label>
                    <select
                      class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                      v-model="staticComponent"
                    >
                      <option value="" disabled>Pilih komponen</option>
                      <option
                        v-for="opt in staticComponentOptions"
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

                  <div>
                    <label class="block text-[12px] mb-1 theme-text-muted">Tipe Chart Statistik</label>
                    <select
                      class="w-full rounded-md text-[13px] px-2 py-2 theme-select"
                      v-model="staticChartType"
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
              </div>

              <Chart
                :type="staticChartType"
                :data="chartDataR"
                :options="chartOptionsR"
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
</style>