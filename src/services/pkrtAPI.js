import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
});

/**
 * =========================================================
 * SOURCE MAP
 * =========================================================
 * pkrt, pkp, pmtb, eksim -> diperlakukan sebagai source global
 * pdb tetap disediakan kalau nanti mau dipakai
 */
const SOURCE_ENDPOINTS = {
  pkrt: {
    indikator: "/api/v1/pkrt/indikator",
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
    yony: "yony",
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

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(/,/g, ".");

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
 * backend quarter kadang datang sebagai:
 * 2018M3, 2018M6, 2018M9, 2018M12
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

/**
 * =========================================================
 * SERIES PICKER
 * =========================================================
 */
const getGrowthSeriesCandidateNames = (canonicalType) => {
  const map = {
    mtom: ["mtom_growth", "mtm_growth", "growth", "mtom", "mtm"],
    yony: ["yony_growth", "yoy_growth", "growth", "yony", "yoy"],
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

  const preferredNames = ["nilai", "value", "data", "annual"];
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
  {
    forcedValueKey,
    quarterPeriodNormalization = false,
  } = {}
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
  {
    canonicalType,
    quarterPeriodNormalization = false,
  } = {}
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

const fetchSingleSeries = async ({
  endpoint,
  configBuilder,
  normalizer,
}) => {
  const result = await safe(async () => {
    const { data } = await api.get(endpoint, configBuilder());
    return normalizer(data);
  });

  return result ?? emptySeries();
};

const fetchFirstWorkingSeriesFromEndpoints = async ({
  endpoints = [],
  configBuilder,
  normalizer,
}) => {
  for (const endpoint of uniqueTruthy(endpoints)) {
    const result = await safe(async () => {
      const { data } = await api.get(endpoint, configBuilder());
      return normalizer(data);
    });

    if (hasSeriesData(result)) return result;
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
      const { data } = await api.get(
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
        const { data } = await api.get(endpoint, configBuilder({}));
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
  const prefix = String(kode ?? "").charAt(0).toUpperCase() || String(source ?? "").toUpperCase();
  const acronym = generateAcronym(deskripsi);
  return `${prefix}-${acronym || String(kode ?? "").toUpperCase()}`;
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

  const { data } = await api.get(config.indikator);
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    source: sourceKey,
    kode: String(item?.kode ?? `${sourceKey.toUpperCase()}-${index + 1}`),
    deskripsi: String(item?.deskripsi ?? item?.kode ?? `Indikator ${index + 1}`),
    apiFreqPrefix: String(item?.kode ?? "").charAt(0).toUpperCase(),
  }));
};

const fetchMonthlyNilaiBySource = async (source, kode) => {
  const config = getSourceConfig(source);
  if (!config) return emptySeries();

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
    endpoints: [config.quarterChart, config.quarter, config.chart, config.timeseries],
    configBuilder: () => getKodeParams(kode),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: true,
      }),
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
 * buildDynamicDatasetFromApi:
 * untuk cards kiri + chart dinamis
 *
 * buildStaticDatasetFromApi:
 * untuk chart statis kanan
 *
 * Secara struktur sama, hanya dipisah supaya jelas
 */
const buildGenericDatasetFromApi = async ({ source, kode, deskripsi }) => {
  try {
    const sourceKey = String(source ?? "").toLowerCase();

    const [
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
      safe(() => fetchMonthlyNilaiBySource(sourceKey, kode)),
      safe(() => fetchQuarterlyNilaiBySource(sourceKey, kode)),
      safe(() => fetchAnnualNilaiBySource(sourceKey, kode)),
      safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "mtom")),
      safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "yony")),
      safe(() => fetchMonthlyGrowthByType(sourceKey, kode, "ytod")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "qtoq")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "yony")),
      safe(() => fetchQuarterlyGrowthByType(sourceKey, kode, "ctoc")),
      safe(() => fetchAnnualGrowthBySource(sourceKey, kode)),
    ]);

    const monthly = monthlyNilai ?? emptySeries();
    const quarterly = quarterlyNilai ?? emptySeries();
    const yearly = yearlyNilai ?? emptySeries();

    return {
      id: `${sourceKey}-${String(kode)}`,
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: toShortCode(sourceKey, kode, deskripsi),
      source: sourceKey,
      apiCode: String(kode),
      apiFreqPrefix: String(kode).charAt(0).toUpperCase(),
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
          yony: monthlyYony ?? emptySeries(),
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
    console.error(`Gagal build dataset ${String(source).toUpperCase()} untuk ${kode}`, error);
    return null;
  }
};

export const buildDynamicDatasetFromApi = async ({
  source,
  kode,
  deskripsi,
}) => {
  return buildGenericDatasetFromApi({ source, kode, deskripsi });
};

export const buildStaticDatasetFromApi = async ({
  source,
  kode,
  deskripsi,
}) => {
  return buildGenericDatasetFromApi({ source, kode, deskripsi });
};

export const buildPdbStaticDatasetFromComponent = async ({
  kode,
  deskripsi,
  measure = "nilai",
}) => {
  try {
    const jenis = measure === "nilai" ? "ADHB" : "ADHK";

    const [
      quarterlyNilai,
      yearlyNilai,
      qtoq,
      yony,
      ctoc,
      annual,
    ] = await Promise.all([
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

    return {
      id: `pdb-static-${String(kode)}-${jenis}`,
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: String(kode),
      source: "pdb",
      apiCode: String(kode),
      apiFreqPrefix: String(kode).charAt(0).toUpperCase(),
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
          yony: emptySeries(),
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

export const buildDatasetFromApi = async ({ kode, deskripsi }) =>
  buildDynamicDatasetFromApi({
    source: "pkrt",
    kode,
    deskripsi,
  });

export default api;