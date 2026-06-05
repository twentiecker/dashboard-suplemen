import { monthNames, DATASET_COLOR_FAMILIES } from "../constants/appChartConstants";

export const normalizeTextKey = (text = "") =>
  String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();

const hasExplicitRupiahMarker = (text = "") => {
  const lower = String(text ?? "").toLowerCase();

  return (
    lower.includes("rupiah") ||
    /\brp\.?\b/.test(lower) ||
    /\bidr\b/.test(lower)
  );
};

export const normalizeUnitLabel = (unit, fallback = "Nilai") => {
  const text = String(unit ?? "").trim();
  if (!text) return fallback;

  const lower = text.toLowerCase();

  if (lower === "%" || lower.includes("persen") || lower.includes("percent")) {
    return "%";
  }

  if (lower.includes("indeks") || lower.includes("index")) {
    return "Indeks";
  }

  /**
   * Penting:
   * Jangan langsung menganggap "ribu", "juta", "miliar", "triliun" sebagai rupiah.
   * Contoh salah sebelumnya:
   * - "Ribu Unit" ikut dianggap "Ribu Rupiah"
   * - "Volume penjualan mobil" ikut punya filter Satuan Rupiah
   *
   * Sekarang hanya dianggap rupiah kalau unit aslinya memang menyebut Rupiah/Rp/IDR.
   */
  const isRupiah = hasExplicitRupiahMarker(lower);

  if (isRupiah && (lower.includes("triliun") || lower.includes("triliyun"))) {
    return "Triliun Rupiah";
  }

  if (
    isRupiah &&
    (
      lower.includes("miliar") ||
      lower.includes("milyar") ||
      lower.includes("miliyar")
    )
  ) {
    return "Miliar Rupiah";
  }

  if (isRupiah && lower.includes("juta")) {
    return "Juta Rupiah";
  }

  if (isRupiah && lower.includes("ribu")) {
    return "Ribu Rupiah";
  }

  return text;
};

export const normalizeRupiahUnit = (unit = "") => {
  const normalized = normalizeUnitLabel(unit, "");

  if (normalized === "Ribu Rupiah") return "Ribu Rupiah";
  if (normalized === "Juta Rupiah") return "Juta Rupiah";
  if (normalized === "Miliar Rupiah") return "Miliar Rupiah";
  if (normalized === "Triliun Rupiah") return "Triliun Rupiah";

  return "";
};

export const isRupiahUnit = (unit = "") => !!normalizeRupiahUnit(unit);

export const getAvailableDisplayUnits = (unitLabel = "") => {
  const normalized = normalizeUnitLabel(unitLabel, "");
  const rupiahUnit = normalizeRupiahUnit(normalized);

  if (!rupiahUnit) {
    return normalized ? [normalized] : [];
  }

  const allRupiahUnits = [
    "Ribu Rupiah",
    "Juta Rupiah",
    "Miliar Rupiah",
    "Triliun Rupiah",
  ];

  return [
    rupiahUnit,
    ...allRupiahUnits.filter((unit) => unit !== rupiahUnit),
  ];
};

export const getRupiahUnitFactor = (unit = "") => {
  const normalized = normalizeRupiahUnit(unit);

  const factorMap = {
    "Ribu Rupiah": 1,
    "Juta Rupiah": 1000,
    "Miliar Rupiah": 1000000,
    "Triliun Rupiah": 1000000000,
  };

  return factorMap[normalized] ?? null;
};

export const convertRupiahValue = (value, fromUnit = "", toUnit = "") => {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return value;
  }

  const fromFactor = getRupiahUnitFactor(fromUnit);
  const toFactor = getRupiahUnitFactor(toUnit);

  if (!fromFactor || !toFactor) {
    return value;
  }

  return num * (fromFactor / toFactor);
};

const getUnitScaleFactor = (fromUnit = "", toUnit = "") => {
  const fromFactor = getRupiahUnitFactor(fromUnit);
  const toFactor = getRupiahUnitFactor(toUnit);

  if (!fromFactor || !toFactor) return 1;
  return fromFactor / toFactor;
};

export const convertSeriesMetaByUnit = (meta = {}, fromUnit = "", toUnit = "") => {
  const from = normalizeRupiahUnit(fromUnit);
  const to = normalizeRupiahUnit(toUnit);

  if (!from || !to) return meta;

  const data = Array.isArray(meta?.data) ? meta.data : [];
  const factor = getUnitScaleFactor(from, to);

  return {
    ...meta,
    data: data.map((value) =>
      typeof value === "number" && Number.isFinite(value)
        ? value * factor
        : value
    ),
    originalData: data,
    originalUnit: from,
    displayUnit: to,
    isRupiahConverted: factor !== 1,
  };
};

export const formatChartNumber = (
  value,
  {
    minFractionDigits = 0,
    maxFractionDigits = 2,
    fallback = "",
  } = {}
) => {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return fallback;
  }

  const isInteger = Number.isInteger(num);

  if (isInteger) {
    const integerPart = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);

    return `${integerPart}.00`;
  }

  let formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(num);

  if (formatted.includes(",")) {
    formatted = formatted
      .replace(/0+$/g, "")
      .replace(/,$/g, "");
  }

  return formatted;
};

export const formatChartNumberFixed = (
  value,
  digits = 2,
  fallback = ""
) => {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return fallback;
  }

  const fixed = num.toFixed(digits);
  const [integerPartRaw, fractionPart = ""] = fixed.split(".");

  const integerPart = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(integerPartRaw));

  return fractionPart ? `${integerPart},${fractionPart}` : integerPart;
};

export const formatChartValueWithUnit = (
  value,
  unit = "",
  {
    minFractionDigits = 0,
    maxFractionDigits = 2,
    fallback = "",
  } = {}
) => {
  const formatted = formatChartNumber(value, {
    minFractionDigits,
    maxFractionDigits,
    fallback,
  });

  if (!formatted) return formatted;
  return unit ? `${formatted} ${unit}` : formatted;
};

export const getDatasetDisplayName = (dataset) => {
  return (
    dataset?.indicatorName ??
    dataset?.deskripsi ??
    dataset?.label ??
    dataset?.name ??
    ""
  );
};

export const getAxisTitleForMeasure = (measure = "nilai") => {
  return measure === "pertumbuhan" ? "PERTUMBUHAN (%)" : "NILAI";
};

export const getRangeLimitByAggregation = (aggregation, rangeKey) => {
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

export const trimMetaByRange = (meta, rangeKey = "8Y") => {
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

export const normalizeYearLikePeriod = (period) => {
  const text = String(period ?? "").trim();
  const match = text.match(/^(\d{4})/);
  return match ? match[1] : text;
};

export const parsePeriod = (period) => {
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

export const formatYearTick = (period) => {
  const p = parsePeriod(period);
  return p.year ? String(p.year) : String(period ?? "");
};

export const formatQuarterMergeTickLabel = (raw) => {
  const text = String(raw ?? "");
  const [period, type] = text.split("__");
  const parsed = parsePeriod(period);

  if (type === "detail") return "Jan–Mar";
  if (type === "total" && parsed.type === "quarterly") {
    return `Q${parsed.quarter} ${parsed.year}`;
  }

  return "";
};

export const formatYearMergeTickLabel = (raw, primaryAggregation = "") => {
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

export const formatTooltipPeriod = (
  period,
  aggregationHint = "",
  primaryAggregationValue = ""
) => {
  const text = String(period ?? "");
  const parts = text.split("__");

  if (parts.length >= 2) {
    const [basePeriod, type] = parts;
    const p = parsePeriod(basePeriod);

    if (type === "detail") {
      if (p.type === "quarterly") return `Detail Q${p.quarter} ${p.year}`;
      if (p.type === "yearly") {
        return primaryAggregationValue === "quarterly"
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

export const getMonthLabelStep = (count) => {
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  if (count <= 36) return 3;
  if (count <= 60) return 4;
  if (count <= 96) return 6;
  return 12;
};

export const getQuarterLabelStep = (count) => {
  if (count <= 4) return 1;
  if (count <= 8) return 2;
  if (count <= 12) return 3;
  if (count <= 20) return 4;
  if (count <= 32) return 6;
  if (count <= 48) return 8;
  return 10;
};

export const buildMonthlyTickLabel = (
  period,
  index,
  totalCount,
  mode = "default"
) => {
  const parsed = parsePeriod(period);
  if (parsed.type !== "monthly") return "";

  const step = getMonthLabelStep(totalCount);
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  if (!isFirst && !isLast && index % step !== 0) return "";

  const monthLabel = monthNames[parsed.month - 1] ?? "";

  if (mode === "ytod") {
    if (parsed.month === 1 || isLast) {
      return [monthLabel, String(parsed.year)];
    }
    return monthLabel;
  }

  if ((parsed.month === 1 && totalCount > 12) || isLast) {
    return [monthLabel, String(parsed.year)];
  }

  return monthLabel;
};

export const buildQuarterlyTickLabel = (
  period,
  index,
  totalCount,
  forceShowAll = false
) => {
  const parsed = parsePeriod(period);
  if (parsed.type !== "quarterly") return "";

  if (!forceShowAll) {
    const step = getQuarterLabelStep(totalCount);
    const isFirst = index === 0;
    const isLast = index === totalCount - 1;
    const isTooCloseToLast = totalCount - 1 - index < step;

    if (isFirst || isLast) {
      return `Q${parsed.quarter} ${parsed.year}`;
    }

    if (isTooCloseToLast) {
      return "";
    }

    if (index % step !== 0) {
      return "";
    }
  }

  return `Q${parsed.quarter} ${parsed.year}`;
};

export const dedupePeriods = (periods = []) =>
  [...new Set(periods.filter(Boolean))].sort((a, b) => {
    const pa = parsePeriod(a);
    const pb = parsePeriod(b);
    return pa.order - pb.order;
  });

export const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

export const hasValidArrayData = (arr = []) =>
  Array.isArray(arr) && arr.some((value) => isFiniteNumber(value));

export const hasValidSeriesData = (seriesLike) => {
  const data = Array.isArray(seriesLike?.data) ? seriesLike.data : [];
  return data.some((value) => isFiniteNumber(value));
};

export const datasetHasAggregationData = (dataset, aggregation, measure = "nilai") => {
  if (!dataset) return false;

  if (aggregation === "monthly" && dataset?.aggregationAvailability?.allowMonthly === false) {
    return false;
  }

  if (aggregation === "quarterly" && dataset?.aggregationAvailability?.allowQuarterly === false) {
    return false;
  }

  if (aggregation === "yearly" && dataset?.aggregationAvailability?.allowYearly === false) {
    return false;
  }

  if (measure === "nilai") {
    if (aggregation === "monthly") return hasValidArrayData(dataset?.series?.monthly);
    if (aggregation === "quarterly") return hasValidArrayData(dataset?.series?.quarterly);
    if (aggregation === "yearly") return hasValidArrayData(dataset?.series?.yearly);
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

export const getSeriesMeta = (dataset, aggregation) => {
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

export const getBackendGrowthMeta = (dataset, aggregation, method, fallbackPeriods = []) => {
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

export const getPreparedSeriesMeta = (dataset, config) => {
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

export const toPointData = (meta) =>
  meta.periods.map((period, index) => ({
    x: period,
    y: meta.data[index] ?? null,
    originalY: Array.isArray(meta?.originalData)
      ? meta.originalData[index] ?? null
      : meta.data[index] ?? null,
    originalUnit: meta?.originalUnit ?? "",
    displayUnit: meta?.displayUnit ?? "",
    isRupiahConverted: !!meta?.isRupiahConverted,
  }));

export const aggregationToAxisId = (aggregation) => {
  if (aggregation === "monthly") return "xMonthly";
  if (aggregation === "quarterly") return "xQuarterly";
  if (aggregation === "yearly") return "xYearly";
  return "xMonthly";
};

export const hexToRgb = (hex) => {
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

export const toRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getDatasetFamilyIndex = (datasetId, datasetOrderMap = {}) => {
  const id = String(datasetId ?? "");
  const mappedIndex = datasetOrderMap[id];

  if (mappedIndex !== undefined && mappedIndex !== null) {
    return mappedIndex % DATASET_COLOR_FAMILIES.length;
  }

  return 0;
};

export const getDatasetStackColor = ({
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

export const createDatasetTooltipMeta = ({
  periods = [],
  sourceAggregation = "",
}) => {
  return {
    tooltipPeriods: periods,
    sourceAggregation,
  };
};

export const getTooltipPeriodForContext = (context) => {
  const dataset = context?.dataset ?? {};
  const dataIndex = context?.dataIndex ?? -1;
  const tooltipPeriods = dataset.tooltipPeriods ?? [];

  return tooltipPeriods[dataIndex] ?? context?.raw?.x ?? null;
};

export const getTooltipAggregationForContext = (context) => {
  return context?.dataset?.sourceAggregation ?? "";
};

export const buildDatasetStyle = ({
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