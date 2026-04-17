<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useChartStore } from "./stores/useChartStore";
import CardComponent from "./components/CardComponent.vue";
import {
  fetchIndicatorsBySource,
  buildDynamicDatasetFromApi,
  buildPdbStaticDatasetFromComponent,
} from "./services/pkrtAPI";

const isGabung = ref(false);
const isMerging = ref(false);
const mergePhase = ref("idle");
const freezeDuration = 160;

const staticComponent = ref("");
const staticPeriod = ref("");
const staticMethod = ref("");
const staticMeasure = ref("pertumbuhan");

const dynamicChartType = ref("line");
const staticChartType = ref("line");
const combineBarMode = ref("standard");

const selectedProvince = ref("indonesia");
const selectedRange = ref("8Y");

const provinceOptions = [
  { label: "INDONESIA", value: "indonesia" },
  { label: "ACEH", value: "aceh" },
  { label: "SUMUT", value: "sumut" },
  { label: "SUMBAR", value: "sumbar" },
  { label: "RIAU", value: "riau" },
  { label: "JAMBI", value: "jambi" },
  { label: "SUMSEL", value: "sumsel" },
  { label: "BENGKULU", value: "bengkulu" },
  { label: "LAMPUNG", value: "lampung" },
  { label: "DKI", value: "dki" },
  { label: "JABAR", value: "jabar" },
  { label: "JATENG", value: "jateng" },
  { label: "DIY", value: "diy" },
  { label: "JATIM", value: "jatim" },
  { label: "BANTEN", value: "banten" },
  { label: "BALI", value: "bali" },
  { label: "NTB", value: "ntb" },
  { label: "NTT", value: "ntt" },
  { label: "KALBAR", value: "kalbar" },
  { label: "KALTENG", value: "kalteng" },
  { label: "KALSEL", value: "kalsel" },
  { label: "KALTIM", value: "kaltim" },
  { label: "SULUT", value: "sulut" },
  { label: "SULTENG", value: "sulteng" },
  { label: "SULSEL", value: "sulsel" },
  { label: "SULTRA", value: "sultra" },
  { label: "GORONTALO", value: "gorontalo" },
  { label: "MALUKU", value: "maluku" },
  { label: "PAPUA", value: "papua" },
];

const rangeButtons = [
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "8Y", value: "8Y" },
];

const chartStore = useChartStore();

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);

const snapshotPiecesVisible = ref(false);
const snapshotPieces = ref([]);

const cards = ref([]);
const isLoadingCards = ref(false);
const isPageBusy = ref(false);

const loadingStageText = ref("Menyiapkan visual...");
const loadingProgressText = ref("Menyelaraskan data dan tampilan");
const loadingPulseKey = ref(0);
const loadingPercent = ref(0);

let loadingStageTimer = null;
let loadingPercentTimer = null;

const pdbIndicatorOptions = ref([]);
const activeSource = ref("");
const activeStaticDatasetRef = ref(null);
const dynamicIndicatorUnitMap = ref({});

const componentRuleMode = ref("admin");
// pilihan: admin | pkrt | pkp | pmtb | xm

const dynamicDatasetCache = new Map();
const staticDatasetCache = new Map();

const FILTER_OPTIONS = {
  measure: [
    { label: "Nilai", value: "nilai" },
    { label: "Pertumbuhan", value: "pertumbuhan" },
  ],
  monthlyMethods: [
    { label: "M to M", value: "mtom" },
    { label: "Y on Y", value: "yony" },
    { label: "Y to D", value: "ytod" },
  ],
  quarterlyMethods: [
    { label: "Q to Q", value: "qtoq" },
    { label: "Y on Y", value: "yony" },
    { label: "C to C", value: "ctoc" },
  ],
  staticPeriod: [
    { label: "Triwulanan", value: "quarterly" },
    { label: "Tahunan", value: "yearly" },
  ],
  staticQuarterlyMethods: [
    { label: "Q to Q", value: "qtoq" },
    { label: "Y on Y", value: "yony" },
    { label: "C to C", value: "ctoc" },
  ],
  chartTypes: [
    { label: "Line Chart", value: "line" },
    { label: "Bar Chart", value: "bar" },
  ],
  combineBarModes: [
    { label: "Mode Standar", value: "standard" },
    { label: "Mode Stack Bar", value: "stack" },
  ],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LOADING_STAGES = [
  {
    title: "Mengambil data...",
    subtitle: "Menghubungkan komponen dengan sumber data",
  },
  {
    title: "Menyusun grafik...",
    subtitle: "Menyiapkan tampilan chart dinamis dan statis",
  },
  {
    title: "Merapikan tampilan...",
    subtitle: "Menyelaraskan filter, card, dan visual akhir",
  },
];

const startLoadingStageAnimation = () => {
  let index = 0;

  loadingStageText.value = LOADING_STAGES[0].title;
  loadingProgressText.value = LOADING_STAGES[0].subtitle;
  loadingPulseKey.value += 1;
  loadingPercent.value = 0;

  if (loadingStageTimer) clearInterval(loadingStageTimer);
  if (loadingPercentTimer) clearInterval(loadingPercentTimer);

  loadingStageTimer = setInterval(() => {
    index = (index + 1) % LOADING_STAGES.length;
    loadingStageText.value = LOADING_STAGES[index].title;
    loadingProgressText.value = LOADING_STAGES[index].subtitle;
    loadingPulseKey.value += 1;
  }, 1100);

  loadingPercentTimer = setInterval(() => {
    const current = loadingPercent.value;

    if (current < 35) {
      loadingPercent.value += 3;
      return;
    }

    if (current < 65) {
      loadingPercent.value += 2;
      return;
    }

    if (current < 88) {
      loadingPercent.value += 1;
      return;
    }

    if (current < 93) {
      loadingPercent.value += 0.3;
    }
  }, 90);
};

const finishLoadingStageAnimation = async () => {
  if (loadingPercentTimer) {
    clearInterval(loadingPercentTimer);
    loadingPercentTimer = null;
  }

  while (loadingPercent.value < 100) {
    loadingPercent.value = Math.min(100, loadingPercent.value + 4);
    await wait(18);
  }
};

const stopLoadingStageAnimation = () => {
  if (loadingStageTimer) {
    clearInterval(loadingStageTimer);
    loadingStageTimer = null;
  }

  if (loadingPercentTimer) {
    clearInterval(loadingPercentTimer);
    loadingPercentTimer = null;
  }
};

const waitUntil = async (checker, timeout = 15000, interval = 60) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (checker()) return true;
    await wait(interval);
  }

  return false;
};

const settleUiRender = async () => {
  await nextTick();
  await nextTick();
  await wait(150);
};

const normalizeTextKey = (text = "") =>
  String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();

const normalizeUnitLabel = (unit, fallback = "Nilai") => {
  const text = String(unit ?? "").trim();
  if (!text) return fallback;

  const lower = text.toLowerCase();

  if (lower === "%" || lower.includes("persen") || lower.includes("percent")) {
    return "%";
  }

  if (lower.includes("indeks") || lower.includes("index")) {
    return "Indeks";
  }

  if (lower.includes("triliun")) {
    return "Triliun Rupiah";
  }

  if (lower.includes("miliar")) {
    return "Miliar Rupiah";
  }

  if (lower.includes("juta")) {
    return "Juta Rupiah";
  }

  return text;
};

const getDatasetDisplayName = (dataset) => {
  return (
    dataset?.indicatorName ??
    dataset?.deskripsi ??
    dataset?.label ??
    dataset?.name ??
    ""
  );
};

const getDatasetUnitLabel = (dataset, measure = "nilai") => {
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
};

const getAxisTitleForMeasure = (measure = "nilai") => {
  return measure === "pertumbuhan" ? "PERTUMBUHAN (%)" : "NILAI";
};

const getLegendLabelWithUnit = (dataset, measure = "nilai") => {
  const name = getDatasetDisplayName(dataset);
  const unit = getDatasetUnitLabel(dataset, measure);
  return unit ? `${name} (${unit})` : name;
};

const getRangeLimitByAggregation = (aggregation, rangeKey) => {
  if (rangeKey === "1Y") {
    if (aggregation === "monthly") return 12;
    if (aggregation === "quarterly") return 4;
    if (aggregation === "yearly") return 1;
  }

  if (rangeKey === "5Y") {
    if (aggregation === "monthly") return 60;
    if (aggregation === "quarterly") return 20;
    if (aggregation === "yearly") return 5;
  }

  if (rangeKey === "8Y") {
    if (aggregation === "monthly") return 96;
    if (aggregation === "quarterly") return 32;
    if (aggregation === "yearly") return 8;
  }

  return null;
};

const trimMetaByRange = (meta, rangeKey = "8Y") => {
  const aggregation = meta?.aggregation ?? "monthly";
  const limit = getRangeLimitByAggregation(aggregation, rangeKey);

  if (!limit) return meta;

  const periods = Array.isArray(meta?.periods) ? meta.periods : [];
  const data = Array.isArray(meta?.data) ? meta.data : [];

  if (periods.length <= limit) return meta;

  return {
    ...meta,
    periods: periods.slice(-limit),
    data: data.slice(-limit),
  };
};

const resolveHeaderSource = (headerText = "") => {
  const acronym = getComponentAcronym(headerText);

  if (acronym === "PKRT") return "pkrt";
  if (acronym === "PKP") return "pkp";
  if (acronym === "PMTB") return "pmtb";
  if (acronym === "EKSPOR" || acronym === "IMPOR") return "xm";

  return "";
};

const shortenComponentLabel = (text = "") => {
  return getComponentAcronym(text);
};

const formatComponentOptionLabel = (item) => {
  const deskripsi = String(item?.deskripsi ?? "").trim();
  const marker = extractLeadingMarker(deskripsi);

  if (/^\d+\.$/.test(marker)) {
    return shortenComponentLabel(deskripsi);
  }

  return deskripsi.replace(/^[a-z]\.\s*/i, "").trim();
};

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const normalizeYearLikePeriod = (period) => {
  const text = String(period ?? "").trim();
  const match = text.match(/^(\d{4})/);
  return match ? match[1] : text;
};

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

const formatQuarterMergeTickLabel = (raw) => {
  const text = String(raw ?? "");
  const [period, type] = text.split("__");
  const parsed = parsePeriod(period);

  if (type === "detail") return "Jan–Mar";
  if (type === "total" && parsed.type === "quarterly") {
    return `Q${parsed.quarter} ${parsed.year}`;
  }

  return "";
};

const formatYearMergeTickLabel = (raw, primaryAggregation = "") => {
  const text = String(raw ?? "");
  const [period, type] = text.split("__");

  if (type === "detail") {
    return primaryAggregation === "quarterly" ? "Q1–Q4" : "Jan–Dec";
  }

  if (type === "total") {
    return normalizeYearLikePeriod(period);
  }

  return "";
};

const formatTooltipPeriod = (period, aggregationHint = "") => {
  const text = String(period ?? "");
  const parts = text.split("__");

  if (parts.length >= 2) {
    const [basePeriod, type] = parts;
    const p = parsePeriod(basePeriod);

    if (type === "detail") {
      if (p.type === "quarterly") return `Detail Q${p.quarter} ${p.year}`;
      if (p.type === "yearly") {
        return primaryAggregation.value === "quarterly"
          ? `Detail ${p.year} (Q1–Q4)`
          : `Detail ${p.year} (Jan–Dec)`;
      }
      return `Detail ${basePeriod}`;
    }

    if (type === "total") {
      if (p.type === "quarterly") return `Q${p.quarter} ${p.year}`;
      if (p.type === "yearly") return `${p.year}`;
      return normalizeYearLikePeriod(basePeriod);
    }
  }

  const p = parsePeriod(period);

  if (p.type === "monthly") return `${monthNames[p.month - 1]} ${p.year}`;
  if (p.type === "quarterly") return `Q${p.quarter} ${p.year}`;
  if (p.type === "yearly") return String(p.year);

  if (aggregationHint === "monthly") return String(period ?? "");
  if (aggregationHint === "quarterly") return String(period ?? "");
  if (aggregationHint === "yearly") return String(period ?? "");

  return String(period ?? "");
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

  if (mode === "ytod") {
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

const dedupePeriods = (periods = []) =>
  [...new Set(periods.filter(Boolean))].sort((a, b) => {
    const pa = parsePeriod(a);
    const pb = parsePeriod(b);
    return pa.order - pb.order;
  });

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const hasValidArrayData = (arr = []) =>
  Array.isArray(arr) && arr.some((value) => isFiniteNumber(value));

const hasValidSeriesData = (seriesLike) => {
  const data = Array.isArray(seriesLike?.data) ? seriesLike.data : [];
  return data.some((value) => isFiniteNumber(value));
};

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

const datasetHasAggregationData = (dataset, aggregation, measure = "nilai") => {
  if (!dataset) return false;

  if (measure === "nilai") {
    if (aggregation === "monthly") {
      return hasValidArrayData(dataset?.series?.monthly);
    }

    if (aggregation === "quarterly") {
      return hasValidArrayData(dataset?.series?.quarterly);
    }

    if (aggregation === "yearly") {
      return hasValidArrayData(dataset?.series?.yearly);
    }

    return false;
  }

  if (aggregation === "monthly") {
    return (
      hasValidSeriesData(dataset?.growth?.monthly?.mtom) ||
      hasValidSeriesData(dataset?.growth?.monthly?.yony_m) ||
      hasValidSeriesData(dataset?.growth?.monthly?.yony) ||
      hasValidSeriesData(dataset?.growth?.monthly?.ytod)
    );
  }

  if (aggregation === "quarterly") {
    return (
      hasValidSeriesData(dataset?.growth?.quarterly?.qtoq) ||
      hasValidSeriesData(dataset?.growth?.quarterly?.yony) ||
      hasValidSeriesData(dataset?.growth?.quarterly?.ctoc)
    );
  }

  if (aggregation === "yearly") {
    return hasValidSeriesData(dataset?.growth?.yearly);
  }

  return false;
};

const getSeriesMeta = (dataset, aggregation) => {
  if (aggregation === "monthly") {
    return {
      data: Array.isArray(dataset?.series?.monthly) ? dataset.series.monthly : [],
      periods: Array.isArray(dataset?.derivedPeriods?.monthly) ? dataset.derivedPeriods.monthly : [],
      aggregation: "monthly",
    };
  }

  if (aggregation === "quarterly") {
    return {
      data: Array.isArray(dataset?.series?.quarterly) ? dataset.series.quarterly : [],
      periods: Array.isArray(dataset?.derivedPeriods?.quarterly) ? dataset.derivedPeriods.quarterly : [],
      aggregation: "quarterly",
    };
  }

  if (aggregation === "yearly") {
    return {
      data: Array.isArray(dataset?.series?.yearly) ? dataset.series.yearly : [],
      periods: Array.isArray(dataset?.derivedPeriods?.yearly) ? dataset.derivedPeriods.yearly : [],
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
  if (aggregation === "yearly") {
    const payload = dataset?.growth?.yearly;

    if (Array.isArray(payload)) {
      return {
        data: payload,
        periods: fallbackPeriods,
        aggregation: "yearly",
      };
    }

    if (payload && typeof payload === "object") {
      return {
        data: Array.isArray(payload.data) ? payload.data : [],
        periods: Array.isArray(payload.periods) ? payload.periods : fallbackPeriods,
        aggregation: "yearly",
      };
    }

    return {
      data: [],
      periods: fallbackPeriods,
      aggregation: "yearly",
    };
  }

  let payload = null;

  if (aggregation === "monthly") {
    if (method === "yony") {
      payload = dataset?.growth?.monthly?.yony_m ?? dataset?.growth?.monthly?.yony;
    } else {
      payload = dataset?.growth?.monthly?.[method];
    }
  } else {
    payload = dataset?.growth?.[aggregation]?.[method];
  }

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
    config?.aggregation ??
    (dataset.rawFrequency === "monthly"
      ? "monthly"
      : dataset.rawFrequency === "quarterly"
        ? "quarterly"
        : "yearly");

  const method =
    config?.method ??
    (aggregation === "monthly"
      ? "mtom"
      : aggregation === "quarterly"
        ? "qtoq"
        : "annual");

  const baseMeta = getSeriesMeta(dataset, aggregation);

  if (measure === "nilai") return baseMeta;

  return getBackendGrowthMeta(dataset, aggregation, method, baseMeta.periods);
};

const toPointData = (meta) =>
  meta.periods.map((period, index) => ({
    x: period,
    y: meta.data[index] ?? null,
  }));

const aggregationToAxisId = (aggregation) => {
  if (aggregation === "monthly") return "xMonthly";
  if (aggregation === "quarterly") return "xQuarterly";
  if (aggregation === "yearly") return "xYearly";
  return "xMonthly";
};

const mapWithConcurrency = async (items, mapper, limit = 4) => {
  const results = new Array(items.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
};

const extractLeadingMarker = (text = "") => {
  const clean = String(text ?? "").trim();
  return clean.match(/^\s*(\d+\.|[a-zA-Z]\.)\s*/)?.[1] ?? "";
};

const stripLeadingMarker = (text = "") => {
  return String(text ?? "")
    .replace(/^\s*(\d+\.|[a-zA-Z]\.)\s*/i, "")
    .trim();
};

const getComponentAcronym = (text = "") => {
  const clean = stripLeadingMarker(text).toUpperCase();

  if (clean.startsWith("PENGELUARAN KONSUMSI RUMAHTANGGA")) return "PKRT";
  if (clean.startsWith("PENGELUARAN KONSUMSI LNPRT")) return "LNPRT";
  if (clean.startsWith("PENGELUARAN KONSUMSI PEMERINTAH")) return "PKP";
  if (clean.startsWith("PEMBENTUKAN MODAL TETAP BRUTO")) return "PMTB";
  if (clean.startsWith("PERUBAHAN INVENTORI")) return "PI";
  if (clean.startsWith("EKSPOR BARANG DAN JASA")) return "EKSPOR";
  if (clean.startsWith("IMPOR BARANG DAN JASA")) return "IMPOR";

  return stripLeadingMarker(text);
};

const buildPdbComponentMappings = (items = []) => {
  let currentHeaderText = "";
  let currentHeaderShort = "";
  let currentHeaderSource = "";

  return items.map((item) => {
    const rawDeskripsi = String(item?.deskripsi ?? "").trim();
    const marker = extractLeadingMarker(rawDeskripsi);
    const isHeader = /^\d+\.$/.test(marker);
    const isSub = /^[a-zA-Z]\.$/.test(marker);

    if (isHeader) {
      currentHeaderText = stripLeadingMarker(rawDeskripsi);
      currentHeaderShort = getComponentAcronym(rawDeskripsi);
      currentHeaderSource = resolveHeaderSource(rawDeskripsi);

      return {
        ...item,
        marker,
        isHeader: true,
        isSub: false,
        deskripsi: currentHeaderText,
        shortLabel: currentHeaderShort,
        fullLabel: currentHeaderText,
        parentHeaderText: currentHeaderText,
        parentHeaderShort: currentHeaderShort,
        mappedSource: currentHeaderSource,
      };
    }

    if (isSub) {
      const cleanSub = stripLeadingMarker(rawDeskripsi);

      return {
        ...item,
        marker,
        isHeader: false,
        isSub: true,
        deskripsi: cleanSub,
        shortLabel: cleanSub,
        fullLabel: cleanSub,
        parentHeaderText: currentHeaderText,
        parentHeaderShort: currentHeaderShort,
        mappedSource: currentHeaderSource,
      };
    }

    const cleanText = stripLeadingMarker(rawDeskripsi);

    return {
      ...item,
      marker,
      isHeader: false,
      isSub: false,
      deskripsi: cleanText,
      shortLabel: cleanText,
      fullLabel: cleanText,
      parentHeaderText: currentHeaderText,
      parentHeaderShort: currentHeaderShort,
      mappedSource: currentHeaderSource,
    };
  });
};

const isAllowedByComponentRule = (item, ruleMode) => {
  const mode = String(ruleMode ?? "admin").toLowerCase();

  if (mode === "admin") return true;

  const source = String(item?.mappedSource ?? "").toLowerCase();

  if (mode === "xm") {
    return source === "xm";
  }

  return source === mode;
};

const getDynamicCacheKey = ({ source, kode }) =>
  `${String(source).toLowerCase()}-${String(kode)}`;

const getCachedDynamicDataset = async (item) => {
  const key = getDynamicCacheKey({
    source: item.source,
    kode: item.kode,
  });

  if (dynamicDatasetCache.has(key)) return dynamicDatasetCache.get(key);

  const dataset = await buildDynamicDatasetFromApi({
    source: item.source,
    kode: item.kode,
    deskripsi: item.deskripsi,
    satuan: item.satuan,
  });

  const mergedDataset = dataset
    ? {
        ...dataset,
        kode: dataset?.kode ?? item?.kode ?? "",
        apiCode: dataset?.apiCode ?? item?.kode ?? "",
        sourceCode: dataset?.sourceCode ?? item?.kode ?? "",
        satuan: dataset?.satuan ?? item?.satuan ?? "",
        deskripsi: dataset?.deskripsi ?? item?.deskripsi ?? "",
        indicatorName:
          dataset?.indicatorName ??
          item?.deskripsi ??
          dataset?.deskripsi ??
          "",
        meta: {
          ...(dataset?.meta ?? {}),
          kode: dataset?.meta?.kode ?? item?.kode ?? "",
          satuan: dataset?.meta?.satuan ?? item?.satuan ?? "",
          deskripsi: dataset?.meta?.deskripsi ?? item?.deskripsi ?? "",
        },
      }
    : null;

  if (mergedDataset) {
    dynamicDatasetCache.set(key, mergedDataset);
  }

  return mergedDataset;
};

const getCachedStaticDataset = async ({ kode, deskripsi, measure }) => {
  const key = `pdb-static-${String(kode)}-${String(measure)}`;

  if (staticDatasetCache.has(key)) return staticDatasetCache.get(key);

  const dataset = await buildPdbStaticDatasetFromComponent({
    kode,
    deskripsi,
    measure,
  });

  if (dataset) {
    staticDatasetCache.set(key, dataset);
  }

  return dataset;
};

const filteredPdbIndicatorOptions = computed(() =>
  pdbIndicatorOptions.value.filter((item) =>
    isAllowedByComponentRule(item, componentRuleMode.value)
  )
);

const globalComponentOptions = computed(() =>
  filteredPdbIndicatorOptions.value.map((item) => ({
    label: item?.shortLabel || item?.deskripsi || "",
    fullLabel: item?.isHeader
      ? (item?.fullLabel || item?.deskripsi || "")
      : "",
    value: String(item.kode),
    isHeader: !!item?.isHeader,
  }))
);

const staticComponentOptions = computed(() =>
  filteredPdbIndicatorOptions.value.map((item) => ({
    label: formatComponentOptionLabel(item),
    value: String(item.kode),
  }))
);

const activeStaticIndicator = computed(() =>
  filteredPdbIndicatorOptions.value.find(
    (item) => String(item.kode) === String(staticComponent.value)
  ) ?? null
);

const activeStaticDataset = computed(() => activeStaticDatasetRef.value ?? null);

const activeMappedSource = computed(() =>
  String(activeStaticIndicator.value?.mappedSource ?? "")
);

const primaryDataset = computed(() => chartStore.selectedDataset?.[0] ?? null);

const primaryRawConfig = computed(() => {
  if (!primaryDataset.value) return null;
  const id = String(primaryDataset.value.id);
  return chartStore.compareConfigs[id] ?? null;
});

const primaryMeasure = computed(() => primaryRawConfig.value?.measure ?? "");
const primaryAggregation = computed(() => primaryRawConfig.value?.aggregation ?? "");
const primaryMethod = computed(() => primaryRawConfig.value?.method ?? "");

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

const loadPdbComponentOptions = async () => {
  try {
    const indikatorPdb = await fetchIndicatorsBySource("pdb");
    const mapped = buildPdbComponentMappings(indikatorPdb);
    pdbIndicatorOptions.value = mapped;

    const filtered = mapped.filter((item) =>
      isAllowedByComponentRule(item, componentRuleMode.value)
    );

    if (!staticComponent.value && filtered.length) {
      staticComponent.value = String(filtered[0].kode);
    } else if (!filtered.length) {
      staticComponent.value = "";
    }
  } catch (err) {
    console.error("Gagal load indikator PDB", err);
    pdbIndicatorOptions.value = [];
    staticComponent.value = "";
  }
};

const loadCardsFromMappedSource = async () => {
  try {
    isLoadingCards.value = true;

    const source = activeMappedSource.value;

    if (!source) {
      cards.value = [];
      activeSource.value = "";
      chartStore.selectedDataset = [];
      await nextTick();
      return;
    }

    activeSource.value = source;

    const indikator = await fetchIndicatorsBySource(source);

    dynamicIndicatorUnitMap.value = indikator.reduce((acc, item) => {
      const unit = String(item?.satuan ?? item?.unit ?? "").trim();
      const kode = String(item?.kode ?? item?.code ?? item?.apiCode ?? "").trim();
      const nama = normalizeTextKey(item?.deskripsi ?? "");

      if (kode) acc[kode] = unit;
      if (nama) acc[`name:${nama}`] = unit;

      return acc;
    }, {});

    const datasets = await mapWithConcurrency(
      indikator.map((item) => ({
        ...item,
        source,
      })),
      async (item) => await getCachedDynamicDataset(item),
      3
    );

    const validDatasets = datasets.filter((item) => item && item.id);
    cards.value = validDatasets;

    if (validDatasets.length) {
      const first = validDatasets[0];

      chartStore.initPrimary(first);
      chartStore.setMeasure(first.id, "nilai");

      if (
        String(first?.apiFreqPrefix ?? first?.apiCode ?? "")
          .charAt(0)
          .toUpperCase() !== "Q" &&
        first.rawFrequency === "monthly"
      ) {
        chartStore.setAggregation(first.id, "monthly");
      } else if (
        first.rawFrequency === "monthly" ||
        first.rawFrequency === "quarterly"
      ) {
        chartStore.setAggregation(first.id, "quarterly");
      } else {
        chartStore.setAggregation(first.id, "yearly");
      }
    } else {
      cards.value = [];
      chartStore.selectedDataset = [];
    }

    await nextTick();
    await nextTick();
  } catch (err) {
    console.error("Gagal load data source terpilih", err);
    cards.value = [];
    activeSource.value = "";
    chartStore.selectedDataset = [];
  } finally {
    await nextTick();
    isLoadingCards.value = false;
  }
};

const loadActiveStaticDataset = async () => {
  try {
    if (!staticComponent.value || !activeStaticIndicator.value) {
      activeStaticDatasetRef.value = null;
      return;
    }

    const dataset = await getCachedStaticDataset({
      kode: activeStaticIndicator.value.kode,
      deskripsi: activeStaticIndicator.value.deskripsi,
      measure: staticMeasure.value,
    });

    activeStaticDatasetRef.value = dataset ?? null;
  } catch (err) {
    console.error("Gagal load dataset statis aktif", err);
    activeStaticDatasetRef.value = null;
  }
};

const reloadBySelectedComponent = async () => {
  chartStore.clearAllCompareConfigs();
  staticMeasure.value = "nilai";

  await loadCardsFromMappedSource();
  await loadActiveStaticDataset();

  if (activeStaticDatasetRef.value) {
    if ((activeStaticDatasetRef.value?.derivedPeriods?.quarterly?.length ?? 0) > 0) {
      staticPeriod.value = "quarterly";
      staticMethod.value = "qtoq";
    } else {
      staticPeriod.value = "yearly";
      staticMethod.value = "annual";
    }
  } else {
    staticPeriod.value = "quarterly";
    staticMethod.value = "qtoq";
  }

  await nextTick();
  await nextTick();
};

onMounted(async () => {
  await withPageBusy(async () => {
    await loadPdbComponentOptions();
    await reloadBySelectedComponent();
  });
});

watch(staticComponent, async (val, oldVal) => {
  if (!val) {
    staticPeriod.value = "";
    staticMethod.value = "";
    activeStaticDatasetRef.value = null;
    cards.value = [];
    activeSource.value = "";
    return;
  }

  if (val === oldVal) return;

  if (!staticPeriod.value) {
    staticPeriod.value = "quarterly";
  }

  await withPageBusy(async () => {
    await reloadBySelectedComponent();
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
    activeStaticDatasetRef.value = null;
    cards.value = [];
    activeSource.value = "";
    chartStore.selectedDataset = [];
    return;
  }

  const stillExists = filtered.some(
    (item) => String(item.kode) === String(staticComponent.value)
  );

  if (!stillExists) {
    staticComponent.value = String(filtered[0].kode);
  }
});

const showStaticPeriodFilter = computed(() => !!staticComponent.value);
const showStaticMethodFilter = computed(
  () =>
    !!staticComponent.value &&
    staticMeasure.value === "pertumbuhan" &&
    staticPeriod.value === "quarterly"
);

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

const palette = [
  { line: "#3B82F6", fill: "rgba(59,130,246,0.45)" },
  { line: "#F59E0B", fill: "rgba(245,158,11,0.45)" },
  { line: "#A855F7", fill: "rgba(168,85,247,0.45)" },
  { line: "#22C55E", fill: "rgba(34,197,94,0.45)" },
  { line: "#EF4444", fill: "rgba(239,68,68,0.45)" },
];

const DATASET_COLOR_FAMILIES = [
  ["#DC2626", "#EF4444", "#F87171", "#FCA5A5", "#FECACA"],
  ["#CA8A04", "#EAB308", "#FACC15", "#FDE047", "#FEF9C3"],
  ["#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0"],
  ["#1E3A8A", "#2563EB", "#3B82F6", "#93C5FD", "#DBEAFE"],
  ["#6B21A8", "#7C3AED", "#8B5CF6", "#C4B5FD", "#EDE9FE"],
];

const hexToRgb = (hex) => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;

  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const toRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getDatasetFamilyIndex = (datasetId, datasetOrderMap = {}) => {
  const id = String(datasetId ?? "");
  const mappedIndex = datasetOrderMap[id];

  if (mappedIndex !== undefined && mappedIndex !== null) {
    return mappedIndex % DATASET_COLOR_FAMILIES.length;
  }

  return 0;
};

const getDatasetStackColor = ({
  datasetId,
  slot = 1,
  mode = "month",
  datasetOrderMap = {},
}) => {
  const family = DATASET_COLOR_FAMILIES[
    getDatasetFamilyIndex(datasetId, datasetOrderMap)
  ];

  if (mode === "quarter") {
    const quarterIndexes = [0, 1, 2, 3];
    const idx = quarterIndexes[(slot - 1) % quarterIndexes.length];
    const hex = family[idx];
    return {
      line: hex,
      fill: toRgba(hex, 0.88),
    };
  }

  const monthIndexes = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 1, 2];
  const idx = monthIndexes[(slot - 1) % monthIndexes.length];
  const hex = family[idx];
  return {
    line: hex,
    fill: toRgba(hex, 0.9),
  };
};

const TOTAL_BAR_COLOR = {
  line: "#14B8A6",
  fill: "rgba(20, 184, 166, 0.35)",
};

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

const getEffectiveAggregation = (dataset) => {
  const id = String(dataset.id);
  const rawConfig = chartStore.compareConfigs[id] ?? null;

  return rawConfig?.aggregation ??
    (dataset.rawFrequency === "monthly"
      ? "monthly"
      : dataset.rawFrequency === "quarterly"
        ? "quarterly"
        : "yearly");
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

  if (!isGabung.value) {
    return leftPreparedDynamicSeries.value;
  }

  if (useStackPeriodMerge.value) {
    return compatibleLeftSeries.value;
  }

  return leftPreparedDynamicSeries.value;
});

const hasGrowthSeriesLeft = computed(() =>
  activeLeftSeries.value.some((item) => item.measure === "pertumbuhan")
);

const hasValueSeriesLeft = computed(() =>
  activeLeftSeries.value.some((item) => item.measure !== "pertumbuhan")
);

const hasMixedMeasureKindsLeft = computed(() => {
  const kinds = new Set(
    activeLeftSeries.value.map((item) => item.measure === "pertumbuhan" ? "pertumbuhan" : "nilai")
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
  return isGabung.value && !!activeStaticDataset.value && staticPeriod.value === "quarterly";
});

const hasYearlySeriesLeft = computed(() =>
  activeLeftSeries.value.some((item) => item.aggregation === "yearly") ||
  (isGabung.value && !!activeStaticDataset.value && staticPeriod.value === "yearly")
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

  if (isGabung.value && activeStaticDataset.value && staticPeriod.value === "quarterly") {
    periods.push(...staticSeriesMeta.value.periods);
  }

  return dedupePeriods(periods);
});

const leftYearlyAxisPeriods = computed(() => {
  const periods = [];
  activeLeftSeries.value.forEach((item) => {
    if (item.aggregation === "yearly") periods.push(...item.meta.periods);
  });

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
  grouped = true,
  maxBarThickness = 34,
  categoryPercentage = 0.72,
  barPercentage = 0.82,
}) => {
  if (chartType === "bar") {
    return {
      type: "bar",
      backgroundColor: fillColor,
      borderColor: lineColor,
      borderWidth: 2,
      borderRadius: 4,
      borderSkipped: false,
      maxBarThickness,
      categoryPercentage,
      barPercentage,
      grouped,
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

const useStackPeriodMerge = computed(() =>
  canUsePeriodStackMerge.value && combineBarMode.value === "stack"
);

const buildMonthlyQuarterlyMergeDatasets = (leftSeries, staticDataset) => {
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
};

const buildMonthlyYearlyMergeDatasets = (leftSeries, staticDataset) => {
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
        label: `${getDatasetDisplayName(seriesItem.dataset)} - ${monthNames[slot - 1]}`,
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
};

const buildQuarterlyYearlyMergeDatasets = (leftSeries, yearlyDataset) => {
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
};

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
  if (isCombineDisabled.value || isPageBusy.value) return;

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

const leftAxisVisibility = computed(() => {
  if (useStackPeriodMerge.value) {
    return {
      monthly: false,
      quarterly: false,
      yearly: false,
    };
  }

  return {
    monthly: hasMonthlySeriesLeft.value,
    quarterly: hasQuarterlySeriesLeft.value,
    yearly: hasYearlySeriesLeft.value,
  };
});

const rightAxisVisibility = computed(() => ({
  monthly: false,
  quarterly: staticPeriod.value === "quarterly",
  yearly: staticPeriod.value === "yearly",
}));

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