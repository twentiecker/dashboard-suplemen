import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
});

/**
 * =========================================================
 * SOURCE MAP
 * =========================================================
 */
const SOURCE_ENDPOINTS = {
  pkrt: {
    indikator: "/api/v1/pkrt/indikator",
    kode: "/api/v1/pkrt/kode",
    chart: "/api/v1/pkrt/chart",
    timeseries: "/api/v1/pkrt/timeseries",
    quarterChart: "/api/v1/pkrt/quarter/chart",
    quarter: "/api/v1/pkrt/quarter",
    annualChart: "/api/v1/pkrt/annual/chart",
    annual: "/api/v1/pkrt/annual",
    growthChart: "/api/v1/pkrt/growth/chart",
    growthAnnual: "/api/v1/pkrt/growth",
  },

  pkp: {
    indikator: "/api/v1/pkp/indikator",
    kode: "/api/v1/pkp/kode",
    chart: "/api/v1/pkp/chart",
    timeseries: "/api/v1/pkp/timeseries",
    quarterChart: "/api/v1/pkp/quarter/chart",
    quarter: "/api/v1/pkp/quarter",
    annualChart: "/api/v1/pkp/annual/chart",
    annual: "/api/v1/pkp/annual",
    growthChart: "/api/v1/pkp/growth/chart",
    growthAnnual: "/api/v1/pkp/growth",
  },

  pmtb: {
    indikator: "/api/v1/pmtb/indikator",
    kode: "/api/v1/pmtb/kode",
    chart: "/api/v1/pmtb/chart",
    timeseries: "/api/v1/pmtb/timeseries",
    quarterChart: "/api/v1/pmtb/quarter/chart",
    quarter: "/api/v1/pmtb/quarter",
    annualChart: "/api/v1/pmtb/annual/chart",
    annual: "/api/v1/pmtb/annual",
    growthChart: "/api/v1/pmtb/growth/chart",
    growthAnnual: "/api/v1/pmtb/growth",
  },

  eksim: {
    indikator: "/api/v1/eksim/indikator",
    kode: "/api/v1/eksim/kode",
    chart: "/api/v1/eksim/chart",
    timeseries: "/api/v1/eksim/timeseries",
    quarterChart: "/api/v1/eksim/quarter/chart",
    quarter: "/api/v1/eksim/quarter",
    annualChart: "/api/v1/eksim/annual/chart",
    annual: "/api/v1/eksim/annual",
    growthChart: "/api/v1/eksim/growth/chart",
    growthAnnual: "/api/v1/eksim/growth",
  },

  pdb: {
    indikator: "/api/v1/pdb/indikator",
    kode: "/api/v1/pdb/kode",
    chart: "/api/v1/pdb/chart",
    timeseries: "/api/v1/pdb/timeseries",
    quarterChart: "/api/v1/pdb/quarter/chart",
    quarter: "/api/v1/pdb/quarter",
    annualChart: "/api/v1/pdb/annual/chart",
    annual: "/api/v1/pdb/annual",
    growthChart: "/api/v1/pdb/growth/chart",
    growthAnnual: "/api/v1/pdb/growth",
  },
};

const GLOBAL_SOURCES = ["pkrt", "pkp", "pmtb", "eksim"];

const emptySeries = () => ({ data: [], periods: [] });

const META_KEYS = new Set([
  "tahun",
  "period",
  "freq",
  "periode",
  "kode",
  "deskripsi",
  "label",
  "name",
  "jenis",
  "komponen",
  "type",
  "satuan",
  "unit",
]);

const VALUE_KEY_PRIORITY = [
  "nilai",
  "value",
  "data",
  "persen",
  "pertumbuhan",
  "growth",
  "rate",
  "mtom",
  "yony_m",
  "yony",
  "ytod",
  "qtoq",
  "ctoc",
  "annual",
  "mtm",
  "yoy",
  "ytd",
  "qtq",
  "ctc",
];

const REQUEST_TYPES = {
  monthly: {
    mtom: "mtom",
    yony: "yony_m",
    ytod: "ytod",
  },
  quarterly: {
    qtoq: "qtoq",
    yony: "yony",
    ctoc: "ctoc",
  },
  yearly: {
    annual: "annual",
  },
};

const safe = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

const hasSeriesData = (series) =>
  Array.isArray(series?.data) &&
  Array.isArray(series?.periods) &&
  series.data.length > 0 &&
  series.periods.length > 0;

const getSourceConfig = (source) =>
  SOURCE_ENDPOINTS[String(source ?? "").toLowerCase()] ?? null;

const uniqueTruthy = (items = []) => [...new Set(items.filter(Boolean))];

const getCodePrefix = (kode) =>
  String(kode ?? "").trim().charAt(0).toUpperCase();

const isQuarterOnlyCode = (kode) => getCodePrefix(kode) === "Q";

/**
 * =========================================================
 * REQUEST CACHE
 * =========================================================
 */
const requestCache = new Map();

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const buildRequestCacheKey = (url, config = {}) => {
  const params = config?.params ?? {};
  return `${String(url)}::${stableStringify(params)}`;
};

const cachedGet = async (url, config = {}) => {
  const key = buildRequestCacheKey(url, config);

  if (requestCache.has(key)) {
    return requestCache.get(key);
  }

  const promise = api.get(url, config);

  requestCache.set(key, promise);

  try {
    const response = await promise;
    return response;
  } catch (error) {
    requestCache.delete(key);
    throw error;
  }
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  const normalized = String(value).replace(/\s/g, "").replace(/,/g, ".");

  const n = Number(normalized);
  return Number.isNaN(n) ? null : n;
};

const detectValueKey = (row = {}) => {
  for (const key of VALUE_KEY_PRIORITY) {
    if (key in row) return key;
  }

  const fallback = Object.keys(row).find((key) => !META_KEYS.has(key));
  return fallback ?? "nilai";
};

const buildPeriod = ({ tahun, period, freq }) => {
  const y = Number(tahun);
  const p = Number(period);

  if (freq === "M") return `${y}M${String(p).padStart(2, "0")}`;
  if (freq === "Q") return `${y}Q${p}`;
  if (freq === "Y" || freq === "A") return `${y}`;
  return String(y);
};

const sortRowsByPeriod = (rows = []) =>
  [...rows].sort((a, b) => {
    if (Number(a?.tahun) !== Number(b?.tahun)) {
      return Number(a?.tahun) - Number(b?.tahun);
    }
    return Number(a?.period) - Number(b?.period);
  });

const rowsToSeries = ({ rows = [], fallbackFreq = "M", valueKey }) => {
  const sorted = sortRowsByPeriod(rows);
  if (!sorted.length) return emptySeries();

  const resolvedValueKey = valueKey ?? detectValueKey(sorted[0]);

  return {
    periods: sorted.map((row) =>
      buildPeriod({
        tahun: row?.tahun,
        period: row?.period,
        freq: row?.freq ?? fallbackFreq,
      })
    ),
    data: sorted.map((row) => toNumberOrNull(row?.[resolvedValueKey])),
  };
};

/**
 * =========================================================
 * PERIOD NORMALIZER
 * =========================================================
 */
const convertMonthlyQuarterMarkerToQuarter = (period) => {
  const text = String(period ?? "").trim().toUpperCase();
  const match = text.match(/^(\d{4})M(3|03|6|06|9|09|12)$/);

  if (!match) return text;

  const year = match[1];
  const month = Number(match[2]);

  const quarterMap = {
    3: 1,
    6: 2,
    9: 3,
    12: 4,
  };

  return `${year}Q${quarterMap[month]}`;
};

const maybeNormalizeQuarterPeriods = (periods = []) => {
  if (!Array.isArray(periods) || !periods.length) return [];

  const allQuarterMarkers = periods.every((item) =>
    /^(\d{4})M(3|03|6|06|9|09|12)$/i.test(String(item ?? "").trim())
  );

  if (!allQuarterMarkers) return periods.map((item) => String(item ?? ""));

  return periods.map(convertMonthlyQuarterMarkerToQuarter);
};

const isQuarterPeriodValue = (period) => {
  const text = String(period ?? "").trim().toUpperCase();

  return (
    /^\d{4}Q[1-4]$/.test(text) ||
    /^(\d{4})M(3|03|6|06|9|09|12)$/.test(text)
  );
};

const isQuarterSeries = (series) => {
  if (!hasSeriesData(series)) return false;

  return series.periods.every((period) => isQuarterPeriodValue(period));
};

/**
 * =========================================================
 * AGGREGATION AVAILABILITY
 * aturan:
 * - freq M + konversi NaN  => monthly true, quarterly false, yearly false
 * - freq Q + konversi NaN  => monthly false, quarterly true, yearly false
 * - freq Y + konversi NaN  => monthly false, quarterly false, yearly true
 * - selain NaN             => mengikuti freq normal turunannya boleh
 * =========================================================
 */
const buildAggregationAvailability = ({ freq = "", konversi = "" } = {}) => {
  const normalizedFreq = String(freq ?? "").trim().toUpperCase();
  const normalizedKonversi = String(konversi ?? "").trim().toUpperCase();
  const isNaNConversion = normalizedKonversi === "NAN";

  if (normalizedFreq === "M") {
    return {
      allowMonthly: true,
      allowQuarterly: !isNaNConversion,
      allowYearly: !isNaNConversion,
    };
  }

  if (normalizedFreq === "Q") {
    return {
      allowMonthly: false,
      allowQuarterly: true,
      allowYearly: !isNaNConversion,
    };
  }

  if (normalizedFreq === "Y" || normalizedFreq === "A") {
    return {
      allowMonthly: false,
      allowQuarterly: false,
      allowYearly: true,
    };
  }

  return {
    allowMonthly: true,
    allowQuarterly: true,
    allowYearly: true,
  };
};

/**
 * =========================================================
 * SERIES PICKER
 * =========================================================
 */
const getGrowthSeriesCandidateNames = (canonicalType) => {
  const map = {
    mtom: ["mtom_growth", "mtm_growth", "growth", "mtom", "mtm"],
    yony: ["yony_m", "yony_growth", "yoy_growth", "growth", "yony", "yoy"],
    ytod: ["ytod_growth", "ytd_growth", "growth", "ytod", "ytd"],
    qtoq: ["qtoq_growth", "qtq_growth", "growth", "qtoq", "qtq"],
    ctoc: ["ctoc_growth", "ctc_growth", "growth", "ctoc", "ctc"],
    annual: ["annual_growth", "growth", "annual"],
  };

  return map[canonicalType] ?? ["growth"];
};

const findSeriesByNames = (series = [], names = []) => {
  if (!Array.isArray(series) || !series.length) return null;

  for (const targetName of names) {
    const found = series.find(
      (item) =>
        String(item?.name ?? "").trim().toLowerCase() ===
        String(targetName).trim().toLowerCase()
    );

    if (found) return found;
  }

  return null;
};

const findValueSeries = (series = []) => {
  if (!Array.isArray(series) || !series.length) return null;

  const preferredNames = ["nilai", "value", "data", "annual", "quarter"];
  const preferred = findSeriesByNames(series, preferredNames);
  if (preferred) return preferred;

  const nonGrowth = series.find((item) => {
    const name = String(item?.name ?? "").toLowerCase();
    return !name.includes("growth");
  });

  return nonGrowth ?? series[0] ?? null;
};

/**
 * =========================================================
 * PAYLOAD NORMALIZER
 * =========================================================
 */
const normalizeObjectArrayPayload = ({
  rows = [],
  fallbackFreq = "M",
  forcedValueKey,
  quarterPeriodNormalization = false,
}) => {
  if (!rows.length) return emptySeries();

  const first = rows[0];
  const valueKey = forcedValueKey ?? detectValueKey(first);

  if ("periode" in first) {
    const periods = rows.map((item) => String(item?.periode ?? ""));
    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: rows.map((item) => toNumberOrNull(item?.[valueKey])),
    };
  }

  const normalized = rowsToSeries({
    rows,
    fallbackFreq,
    valueKey,
  });

  return {
    periods: quarterPeriodNormalization
      ? maybeNormalizeQuarterPeriods(normalized.periods)
      : normalized.periods,
    data: normalized.data,
  };
};

const normalizeValuePayload = (
  payload,
  { forcedValueKey, quarterPeriodNormalization = false } = {}
) => {
  if (Array.isArray(payload)) {
    if (!payload.length) return emptySeries();

    if (typeof payload[0] === "object") {
      return normalizeObjectArrayPayload({
        rows: payload,
        fallbackFreq: payload?.[0]?.freq ?? "M",
        forcedValueKey,
        quarterPeriodNormalization,
      });
    }

    return {
      periods: [],
      data: payload.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.data)) {
    if (!payload.data.length) return emptySeries();

    if (typeof payload.data[0] === "object") {
      return normalizeObjectArrayPayload({
        rows: payload.data,
        fallbackFreq: payload.data?.[0]?.freq ?? "M",
        forcedValueKey,
        quarterPeriodNormalization,
      });
    }

    const periods = Array.isArray(payload?.periode)
      ? payload.periode.map(String)
      : [];

    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: payload.data.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.xAxis) && Array.isArray(payload?.series)) {
    const periods = payload.xAxis.map(String);
    const valueSeries = findValueSeries(payload.series);

    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: Array.isArray(valueSeries?.data)
        ? valueSeries.data.map(toNumberOrNull)
        : [],
    };
  }

  if (Array.isArray(payload?.labels) && Array.isArray(payload?.values)) {
    return {
      periods: payload.labels.map(String),
      data: payload.values.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.periode) && Array.isArray(payload?.nilai)) {
    const periods = payload.periode.map(String);
    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: payload.nilai.map(toNumberOrNull),
    };
  }

  return emptySeries();
};

const normalizeGrowthPayload = (
  payload,
  { canonicalType, quarterPeriodNormalization = false } = {}
) => {
  if (!payload) return emptySeries();

  const growthCandidateNames = getGrowthSeriesCandidateNames(canonicalType);

  if (Array.isArray(payload)) {
    if (!payload.length) return emptySeries();

    if (typeof payload[0] === "object") {
      const first = payload[0];
      const growthKey =
        growthCandidateNames.find((name) => name in first) ??
        (("growth" in first && "period" in first) ? "growth" : null) ??
        detectValueKey(first);

      const periods = payload.map((item) =>
        String(item?.periode ?? item?.period ?? item?.tahun ?? "")
      );

      return {
        periods: quarterPeriodNormalization
          ? maybeNormalizeQuarterPeriods(periods)
          : periods,
        data: payload.map((item) => toNumberOrNull(item?.[growthKey])),
      };
    }

    return {
      periods: [],
      data: payload.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.data) && payload.data.length) {
    if (typeof payload.data[0] === "object") {
      const first = payload.data[0];
      const growthKey =
        growthCandidateNames.find((name) => name in first) ??
        (("growth" in first &&
          ("period" in first || "periode" in first))
          ? "growth"
          : null) ??
        detectValueKey(first);

      const periods = payload.data.map((item) =>
        String(item?.periode ?? item?.period ?? item?.tahun ?? "")
      );

      return {
        periods: quarterPeriodNormalization
          ? maybeNormalizeQuarterPeriods(periods)
          : periods,
        data: payload.data.map((item) => toNumberOrNull(item?.[growthKey])),
      };
    }

    const periods = Array.isArray(payload?.periode)
      ? payload.periode.map(String)
      : [];

    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: payload.data.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.xAxis) && Array.isArray(payload?.series)) {
    const periods = payload.xAxis.map(String);
    const growthSeries =
      findSeriesByNames(payload.series, growthCandidateNames) ??
      payload.series.find((item) =>
        String(item?.name ?? "").toLowerCase().includes("growth")
      ) ??
      findValueSeries(payload.series) ??
      null;

    return {
      periods: quarterPeriodNormalization
        ? maybeNormalizeQuarterPeriods(periods)
        : periods,
      data: Array.isArray(growthSeries?.data)
        ? growthSeries.data.map(toNumberOrNull)
        : [],
    };
  }

  return emptySeries();
};

const normalizeAnnualPayload = (payload) => {
  const toYearString = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const text = String(value).trim();

    const match = text.match(/^(\d{4})/);
    if (match) return match[1];

    return text;
  };

  if (Array.isArray(payload)) {
    if (!payload.length) return emptySeries();

    if (typeof payload[0] === "object") {
      const first = payload[0];
      const valueKey = detectValueKey(first);

      return {
        periods: payload.map((item) =>
          toYearString(item?.periode ?? item?.period ?? item?.tahun)
        ),
        data: payload.map((item) => toNumberOrNull(item?.[valueKey])),
      };
    }

    return {
      periods: [],
      data: payload.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.data)) {
    if (!payload.data.length) return emptySeries();

    if (typeof payload.data[0] === "object") {
      const first = payload.data[0];
      const valueKey = detectValueKey(first);

      return {
        periods: payload.data.map((item) =>
          toYearString(item?.periode ?? item?.period ?? item?.tahun)
        ),
        data: payload.data.map((item) => toNumberOrNull(item?.[valueKey])),
      };
    }

    return {
      periods: Array.isArray(payload?.periode)
        ? payload.periode.map(toYearString)
        : [],
      data: payload.data.map(toNumberOrNull),
    };
  }

  if (Array.isArray(payload?.xAxis) && Array.isArray(payload?.series)) {
    const valueSeries = findValueSeries(payload.series);

    return {
      periods: payload.xAxis.map(toYearString),
      data: Array.isArray(valueSeries?.data)
        ? valueSeries.data.map(toNumberOrNull)
        : [],
    };
  }

  return emptySeries();
};

/**
 * =========================================================
 * REQUEST HELPERS
 * =========================================================
 */
const getKodeParams = (kode, extra = {}) => ({
  params: { kode, ...extra },
});

const fetchFirstWorkingSeriesFromEndpoints = async ({
  endpoints = [],
  configBuilder,
  normalizer,
  validator,
}) => {
  for (const endpoint of uniqueTruthy(endpoints)) {
    const result = await safe(async () => {
      const { data } = await cachedGet(endpoint, configBuilder());
      return normalizer(data);
    });

    if (!hasSeriesData(result)) continue;
    if (typeof validator === "function" && !validator(result)) continue;

    return result;
  }

  return emptySeries();
};

const fetchGrowthSeries = async ({
  endpoints = [],
  configBuilder,
  canonicalType,
  quarterPeriodNormalization = false,
  tryWithoutType = false,
}) => {
  for (const endpoint of uniqueTruthy(endpoints)) {
    const resultWithType = await safe(async () => {
      const { data } = await cachedGet(
        endpoint,
        configBuilder({ type: canonicalType })
      );

      return normalizeGrowthPayload(data, {
        canonicalType,
        quarterPeriodNormalization,
      });
    });

    if (hasSeriesData(resultWithType)) return resultWithType;

    if (tryWithoutType) {
      const resultWithoutType = await safe(async () => {
        const { data } = await cachedGet(endpoint, configBuilder({}));
        return normalizeGrowthPayload(data, {
          canonicalType,
          quarterPeriodNormalization,
        });
      });

      if (hasSeriesData(resultWithoutType)) return resultWithoutType;
    }
  }

  return emptySeries();
};

const generateAcronym = (text = "") => {
  return String(text)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const cleanWord = String(word).trim();

      if (
        cleanWord.length > 1 &&
        cleanWord.length <= 5 &&
        cleanWord === cleanWord.toUpperCase() &&
        /[A-Z]/.test(cleanWord)
      ) {
        return cleanWord;
      }

      return cleanWord.charAt(0).toUpperCase();
    })
    .join("");
};

const toShortCode = (source, kode, deskripsi) => {
  const prefix =
    String(kode ?? "").charAt(0).toUpperCase() ||
    String(source ?? "").toUpperCase();
  const acronym = generateAcronym(deskripsi);
  return `${prefix}-${acronym || String(kode ?? "").toUpperCase()}`;
};

const fetchKodeMetaBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  if (!config?.kode) {
    return {
      satuan: "",
      freq: "",
      konversi: "",
    };
  }

  const result = await safe(async () => {
    const { data } = await cachedGet(config.kode, getKodeParams(kode));

    const pickItem = (payload) => {
      if (Array.isArray(payload)) return payload[0] ?? null;
      if (Array.isArray(payload?.data)) return payload.data[0] ?? null;
      if (payload && typeof payload === "object") return payload;
      return null;
    };

    const item = pickItem(data);

    return {
      satuan: String(
        item?.satuan ??
        item?.unit ??
        item?.satuan_data ??
        item?.satuan_indikator ??
        ""
      ).trim(),
      freq: String(item?.freq ?? "").trim().toUpperCase(),
      konversi: String(item?.konversi ?? "").trim(),
    };
  });

  return result ?? {
    satuan: "",
    freq: "",
    konversi: "",
  };
};

const fetchUnitBySource = async (source, kode) => {
  const meta = await fetchKodeMetaBySource(source, kode);
  return String(meta?.satuan ?? "").trim();
};

/**
 * =========================================================
 * GENERIC SOURCE FETCHERS
 * =========================================================
 */
export const fetchIndicatorsBySource = async (source) => {
  const sourceKey = String(source ?? "").toLowerCase();
  const config = getSourceConfig(sourceKey);

  if (!config?.indikator) return [];

  const { data } = await cachedGet(config.indikator);
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    source: sourceKey,
    kode: String(item?.kode ?? `${sourceKey.toUpperCase()}-${index + 1}`),
    deskripsi: String(
      item?.deskripsi ?? item?.kode ?? `Indikator ${index + 1}`
    ),
    apiFreqPrefix: String(item?.kode ?? "").charAt(0).toUpperCase(),
    satuan: String(
      item?.satuan ??
      item?.unit ??
      item?.satuan_data ??
      item?.satuan_indikator ??
      ""
    ).trim(),
  }));
};

const fetchMonthlyNilaiBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  if (!config) return emptySeries();
  if (isQuarterOnlyCode(kode)) return emptySeries();

  return fetchFirstWorkingSeriesFromEndpoints({
    endpoints: [config.timeseries, config.chart],
    configBuilder: () => getKodeParams(kode),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: false,
      }),
  });
};

const fetchQuarterlyNilaiBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  if (!config) return emptySeries();

  return fetchFirstWorkingSeriesFromEndpoints({
    endpoints: isQuarterOnlyCode(kode)
      ? [config.quarterChart, config.quarter, config.chart, config.timeseries]
      : [config.quarterChart, config.quarter],
    configBuilder: () => getKodeParams(kode),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: true,
      }),
    validator: isQuarterSeries,
  });
};

const fetchAnnualNilaiBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  if (!config) return emptySeries();

  return fetchFirstWorkingSeriesFromEndpoints({
    endpoints: [config.annualChart, config.annual],
    configBuilder: () => getKodeParams(kode),
    normalizer: normalizeAnnualPayload,
  });
};

const fetchMonthlyGrowthByType = async (source, kode, canonicalType) => {
  const config = getSourceConfig(source);
  const requestType = REQUEST_TYPES.monthly[canonicalType];

  if (!config || !requestType) return emptySeries();
  if (isQuarterOnlyCode(kode)) return emptySeries();

  return fetchGrowthSeries({
    endpoints: [config.growthChart],
    configBuilder: (extra) => getKodeParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: false,
    tryWithoutType: false,
  });
};

const fetchQuarterlyGrowthByType = async (source, kode, canonicalType) => {
  const config = getSourceConfig(source);
  const requestType = REQUEST_TYPES.quarterly[canonicalType];

  if (!config || !requestType) return emptySeries();

  return fetchGrowthSeries({
    endpoints: [config.growthChart],
    configBuilder: (extra) => getKodeParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: true,
    tryWithoutType: false,
  });
};

const fetchAnnualGrowthBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  const requestType = REQUEST_TYPES.yearly.annual;

  if (!config || !requestType) return emptySeries();

  return fetchGrowthSeries({
    endpoints: [config.growthAnnual, config.growthChart],
    configBuilder: (extra) => getKodeParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: false,
    tryWithoutType: true,
  });
};

/**
 * =========================================================
 * DATASET BUILDERS
 * =========================================================
 */
const buildGenericDatasetFromApi = async ({
  source,
  kode,
  deskripsi,
  satuan = "",
}) => {
  try {
    const sourceKey = String(source ?? "").toLowerCase();
    const quarterOnly = isQuarterOnlyCode(kode);

    const [
      kodeMeta,
      monthlyNilai,
      quarterlyNilai,
      yearlyNilai,
      mtom,
      monthlyYony,
      ytod,
      qtoq,
      quarterlyYony,
      ctoc,
      annual,
    ] = await Promise.all([
      safe(() => fetchKodeMetaBySource(sourceKey, kode)),
      safe(() => fetchMonthlyNilaiBySource(sourceKey, kode)),
      safe(() => fetchQuarterlyNilaiBySource(sourceKey, kode)),
      safe(() => fetchAnnualNilaiBySource(sourceKey, kode)),
      quarterOnly
        ? Promise.resolve(emptySeries())
        : safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "mtom")),
      quarterOnly
        ? Promise.resolve(emptySeries())
        : safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "yony")),
      quarterOnly
        ? Promise.resolve(emptySeries())
        : safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "ytod")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "qtoq")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "yony")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "ctoc")),
      safe(() => fetchAnnualGrowthBySource(sourceKey, kode)),
    ]);

    const monthly = monthlyNilai ?? emptySeries();
    const quarterly = quarterlyNilai ?? emptySeries();
    const yearly = yearlyNilai ?? emptySeries();

    const resolvedUnit = String(kodeMeta?.satuan ?? satuan ?? "").trim();
    const resolvedFreq = String(kodeMeta?.freq ?? "").trim().toUpperCase();
    const resolvedKonversi = String(kodeMeta?.konversi ?? "").trim();
    const aggregationAvailability = buildAggregationAvailability({
      freq: resolvedFreq,
      konversi: resolvedKonversi,
    });

    return {
      id: `${sourceKey}-${String(kode)}`,
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: toShortCode(sourceKey, kode, deskripsi),
      source: sourceKey,
      apiCode: String(kode),
      apiFreqPrefix: String(kode).charAt(0).toUpperCase(),
      valueUnitLabel: resolvedUnit,
      growthUnitLabel: "%",

      kodeMeta: {
        freq: resolvedFreq,
        konversi: resolvedKonversi,
      },

      aggregationAvailability,

      meta: {
        kode: String(kode),
        deskripsi: String(deskripsi),
        satuan: resolvedUnit,
        freq: resolvedFreq,
        konversi: resolvedKonversi,
        source: sourceKey,
      },

      rawFrequency:
        monthly.periods.length > 0
          ? "monthly"
          : quarterly.periods.length > 0
            ? "quarterly"
            : yearly.periods.length > 0
              ? "yearly"
              : "unknown",

      derivedPeriods: {
        monthly: monthly.periods,
        quarterly: quarterly.periods,
        yearly: yearly.periods,
      },

      series: {
        monthly: monthly.data,
        quarterly: quarterly.data,
        yearly: yearly.data,
      },

      growth: {
        monthly: {
          mtom: mtom ?? emptySeries(),
          yony_m: monthlyYony ?? emptySeries(),
          ytod: ytod ?? emptySeries(),
        },
        quarterly: {
          qtoq: qtoq ?? emptySeries(),
          yony: quarterlyYony ?? emptySeries(),
          ctoc: ctoc ?? emptySeries(),
        },
        yearly: annual ?? emptySeries(),
      },

      tension: 0.4,
    };
  } catch (error) {
    console.error(
      `Gagal build dataset ${String(source).toUpperCase()} untuk ${kode}`,
      error
    );
    return null;
  }
};

export const buildDynamicDatasetFromApi = async ({
  source,
  kode,
  deskripsi,
  satuan = "",
}) => {
  return buildGenericDatasetFromApi({ source, kode, deskripsi, satuan });
};

export const buildStaticDatasetFromApi = async ({
  source,
  kode,
  deskripsi,
  satuan = "",
}) => {
  return buildGenericDatasetFromApi({ source, kode, deskripsi, satuan });
};

export const buildPdbStaticDatasetFromComponent = async ({
  kode,
  deskripsi,
  measure = "nilai",
}) => {
  try {
    const jenis = measure === "nilai" ? "ADHB" : "ADHK";

    const [
      resolvedUnitFromKode,
      quarterlyNilai,
      yearlyNilai,
      qtoq,
      yony,
      ctoc,
      annual,
    ] = await Promise.all([
      fetchUnitBySource("pdb", kode),
      fetchFirstWorkingSeriesFromEndpoints({
        endpoints: [
          SOURCE_ENDPOINTS.pdb.chart,
          SOURCE_ENDPOINTS.pdb.timeseries,
          SOURCE_ENDPOINTS.pdb.quarterChart,
          SOURCE_ENDPOINTS.pdb.quarter,
        ],
        configBuilder: () => ({
          params: { kode, jenis },
        }),
        normalizer: (payload) =>
          normalizeValuePayload(payload, {
            quarterPeriodNormalization: true,
          }),
      }),

      fetchFirstWorkingSeriesFromEndpoints({
        endpoints: [
          SOURCE_ENDPOINTS.pdb.annualChart,
          SOURCE_ENDPOINTS.pdb.annual,
        ],
        configBuilder: () => ({
          params: { kode, jenis },
        }),
        normalizer: normalizeAnnualPayload,
      }),

      fetchGrowthSeries({
        endpoints: [SOURCE_ENDPOINTS.pdb.growthChart],
        configBuilder: (extra) => ({
          params: { kode, jenis: "ADHK", ...extra },
        }),
        canonicalType: "qtoq",
        quarterPeriodNormalization: true,
        tryWithoutType: false,
      }),

      fetchGrowthSeries({
        endpoints: [SOURCE_ENDPOINTS.pdb.growthChart],
        configBuilder: (extra) => ({
          params: { kode, jenis: "ADHK", ...extra },
        }),
        canonicalType: "yony",
        quarterPeriodNormalization: true,
        tryWithoutType: false,
      }),

      fetchGrowthSeries({
        endpoints: [SOURCE_ENDPOINTS.pdb.growthChart],
        configBuilder: (extra) => ({
          params: { kode, jenis: "ADHK", ...extra },
        }),
        canonicalType: "ctoc",
        quarterPeriodNormalization: true,
        tryWithoutType: false,
      }),

      fetchGrowthSeries({
        endpoints: [SOURCE_ENDPOINTS.pdb.growthAnnual, SOURCE_ENDPOINTS.pdb.growthChart],
        configBuilder: (extra) => ({
          params: { kode, jenis: "ADHK", ...extra },
        }),
        canonicalType: "annual",
        quarterPeriodNormalization: false,
        tryWithoutType: true,
      }),
    ]);

    const resolvedUnit = String(resolvedUnitFromKode ?? "").trim();

    return {
      id: `pdb-static-${String(kode)}-${jenis}`,
      label: String(kode),
      indicatorName: String(deskripsi),
      deskripsi: String(deskripsi),
      kode: String(kode),
      sourceCode: String(kode),
      satuan: resolvedUnit,
      unit: resolvedUnit,
      groupCode: String(kode),
      source: "pdb",
      apiCode: String(kode),
      apiFreqPrefix: String(kode).charAt(0).toUpperCase(),
      valueUnitLabel: resolvedUnit,
      growthUnitLabel: "%",
      meta: {
        kode: String(kode),
        deskripsi: String(deskripsi),
        satuan: resolvedUnit,
        unit: resolvedUnit,
        source: "pdb",
      },
      rawFrequency:
        (quarterlyNilai?.periods?.length ?? 0) > 0
          ? "quarterly"
          : (yearlyNilai?.periods?.length ?? 0) > 0
            ? "yearly"
            : "quarterly",
      derivedPeriods: {
        monthly: [],
        quarterly: quarterlyNilai?.periods ?? [],
        yearly: yearlyNilai?.periods ?? [],
      },
      series: {
        monthly: [],
        quarterly: quarterlyNilai?.data ?? [],
        yearly: yearlyNilai?.data ?? [],
      },
      growth: {
        monthly: {
          mtom: emptySeries(),
          yony_m: emptySeries(),
          ytod: emptySeries(),
        },
        quarterly: {
          qtoq: qtoq ?? emptySeries(),
          yony: yony ?? emptySeries(),
          ctoc: ctoc ?? emptySeries(),
        },
        yearly: annual ?? emptySeries(),
      },
      tension: 0.4,
    };
  } catch (error) {
    console.error(`Gagal build static PDB component untuk ${kode}`, error);
    return null;
  }
};

/**
 * =========================================================
 * GLOBAL SOURCE OPTIONS
 * =========================================================
 */
export const getGlobalSourceOptions = () =>
  GLOBAL_SOURCES.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

/**
 * =========================================================
 * BACKWARD COMPATIBILITY
 * =========================================================
 */
export const fetchPkrtIndicators = async () => fetchIndicatorsBySource("pkrt");

export const buildDatasetFromApi = async ({ kode, deskripsi, satuan = "" }) =>
  buildDynamicDatasetFromApi({
    source: "pkrt",
    kode,
    deskripsi,
    satuan,
  });

export default api;