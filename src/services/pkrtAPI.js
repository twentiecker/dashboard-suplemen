import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
});

/**
 * =========================================================
 * ENDPOINT MAP
 * =========================================================
 */
const ENDPOINTS = {
  pkrt: {
    indikator: "/api/v1/pkrt/indikator",
    chart: "/api/v1/pkrt/chart",
    timeseries: "/api/v1/pkrt/timeseries",
    annual: "/api/v1/pkrt/annual/chart",
    growthChart: "/api/v1/pkrt/growth/chart",
    growthAnnual: "/api/v1/pkrt/growth",
    quarterChart: "/api/v1/pkrt/quarter/chart"
  },
  pdb: {
    indikator: "/api/v1/pdb/indikator",
    chart: "/api/v1/pdb/chart",
    timeseries: "/api/v1/pdb/timeseries",
    annual: "/api/v1/pdb/annual",
    growthChart: "/api/v1/pdb/growth/chart",
    growthAnnual: "/api/v1/pdb/growth",
  },
};

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

const PKRT_REQUEST_TYPES = {
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

const PDB_REQUEST_TYPES = {
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
 * PKRT triwulanan prefix M / endpoint growth triwulanan
 * sekarang memang datang dalam format:
 * 2018M3, 2018M6, 2018M9, 2018M12
 * tapi itu MAKSUDNYA quarter:
 * 2018Q1, 2018Q2, 2018Q3, 2018Q4
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
    const found = series.find((item) =>
      String(item?.name ?? "")
        .trim()
        .toLowerCase() === String(targetName).trim().toLowerCase()
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

  /**
   * Kasus annual growth:
   * [
   *   { period: "2018", nilai: null, growth: null },
   *   { period: "2019", nilai: 497, growth: -7.96 }
   * ]
   */
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

  /**
   * Kasus:
   * { data: [ {periode, nilai, growth}, ... ] }
   */
  if (Array.isArray(payload?.data) && payload.data.length) {
    if (typeof payload.data[0] === "object") {
      const first = payload.data[0];
      const growthKey =
        growthCandidateNames.find((name) => name in first) ??
        (("growth" in first && ("period" in first || "periode" in first)) ? "growth" : null) ??
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

  /**
   * Kasus chart backend:
   * {
   *   xAxis: [...],
   *   series: [
   *     { name: "nilai", data: [...] },
   *     { name: "qtoq_growth", data: [...] }
   *   ]
   * }
   */
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

  // Kasus array object
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

  // Kasus { data: [...] }
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

  // Kasus xAxis + series
  if (Array.isArray(payload?.xAxis) && Array.isArray(payload?.series)) {
    const valueSeries = findValueSeries(payload.series);

    return {
      periods: payload.xAxis.map(toYearString),
      data: Array.isArray(valueSeries?.data)
        ? valueSeries.data.map(toNumberOrNull)
        : [],
    };
  }

  // fallback
  return emptySeries();
};
/**
 * =========================================================
 * REQUEST PARAMS
 * =========================================================
 */
const getPkrtParams = (kode, extra = {}) => ({
  params: { kode, ...extra },
});

const getPdbParams = (kode, jenis = "ADHB", extra = {}) => ({
  params: { kode, jenis, ...extra },
});

/**
 * =========================================================
 * GENERIC FETCHERS
 * =========================================================
 */
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
  for (const endpoint of endpoints) {
    const result = await safe(async () => {
      const { data } = await api.get(endpoint, configBuilder());
      return normalizer(data);
    });

    if (hasSeriesData(result)) return result;
  }

  return emptySeries();
};

const fetchGrowthSeries = async ({
  endpoint,
  configBuilder,
  canonicalType,
  quarterPeriodNormalization = false,
  tryWithoutType = false,
}) => {
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

  return emptySeries();
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */
const generateAcronym = (text = "") => {
  return String(text)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const cleanWord = String(word).trim();

      // kalau kata sudah berupa akronim kapital, pakai utuh
      // contoh: IKK, IHK, PDB, dll
      if (
        cleanWord.length > 1 &&
        cleanWord.length <= 5 &&
        cleanWord === cleanWord.toUpperCase() &&
        /[A-Z]/.test(cleanWord)
      ) {
        return cleanWord;
      }

      // selain itu ambil huruf depan
      return cleanWord.charAt(0).toUpperCase();
    })
    .join("");
};

const toPkrtShortCode = (kode, deskripsi) => {
  const prefix = String(kode ?? "").charAt(0).toUpperCase();
  const acronym = generateAcronym(deskripsi);
  return `${prefix}-${acronym}`;
};

/**
 * =========================================================
 * PKRT
 * =========================================================
 */
export const fetchPkrtIndicators = async () => {
  const { data } = await api.get(ENDPOINTS.pkrt.indikator);
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    kode: String(item?.kode ?? `PKRT-${index + 1}`),
    deskripsi: String(item?.deskripsi ?? item?.kode ?? `Indikator ${index + 1}`),
    source: "pkrt",
    apiFreqPrefix: String(item?.kode ?? "").charAt(0).toUpperCase(),
  }));
};

export const fetchPkrtMonthlyNilai = async (kode) => {
  return fetchSingleSeries({
    endpoint: ENDPOINTS.pkrt.chart,
    configBuilder: () => getPkrtParams(kode),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: false,
      }),
  });
};

export const fetchPkrtQuarterlyNilai = async (kode) => {
  return fetchFirstWorkingSeriesFromEndpoints({
    endpoints: [ENDPOINTS.pkrt.quarterChart, ENDPOINTS.pkrt.chart],
    configBuilder: () => getPkrtParams(kode),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: true,
      }),
  });
};

export const fetchPkrtAnnualNilai = async (kode) => {
  return fetchSingleSeries({
    endpoint: ENDPOINTS.pkrt.annual,
    configBuilder: () => getPkrtParams(kode),
    normalizer: normalizeAnnualPayload,
  });
};

export const fetchPkrtMonthlyGrowthByType = async (kode, canonicalType) => {
  const requestType = PKRT_REQUEST_TYPES.monthly[canonicalType];
  if (!requestType) return emptySeries();

  return fetchGrowthSeries({
    endpoint: ENDPOINTS.pkrt.growthChart,
    configBuilder: (extra) => getPkrtParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: false,
    tryWithoutType: false,
  });
};

export const fetchPkrtQuarterlyGrowthByType = async (kode, canonicalType) => {
  const requestType = PKRT_REQUEST_TYPES.quarterly[canonicalType];
  if (!requestType) return emptySeries();

  return fetchGrowthSeries({
    endpoint: ENDPOINTS.pkrt.growthChart,
    configBuilder: (extra) => getPkrtParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: true,
    tryWithoutType: false,
  });
};

export const fetchPkrtAnnualGrowth = async (kode) => {
  const requestType = PKRT_REQUEST_TYPES.yearly.annual;
  return fetchGrowthSeries({
    endpoint: ENDPOINTS.pkrt.growthAnnual,
    configBuilder: (extra) => getPkrtParams(kode, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: false,
    tryWithoutType: true,
  });
};

export const buildDatasetFromApi = async ({ kode, deskripsi }) => {
  try {
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
      safe(() => fetchPkrtMonthlyNilai(kode)),
      safe(() => fetchPkrtQuarterlyNilai(kode)),
      safe(() => fetchPkrtAnnualNilai(kode)),
      safe(() => fetchPkrtMonthlyGrowthByType(kode, "mtom")),
      safe(() => fetchPkrtMonthlyGrowthByType(kode, "yony")),
      safe(() => fetchPkrtMonthlyGrowthByType(kode, "ytod")),
      safe(() => fetchPkrtQuarterlyGrowthByType(kode, "qtoq")),
      safe(() => fetchPkrtQuarterlyGrowthByType(kode, "yony")),
      safe(() => fetchPkrtQuarterlyGrowthByType(kode, "ctoc")),
      safe(() => fetchPkrtAnnualGrowth(kode)),
    ]);

    const monthly = monthlyNilai ?? emptySeries();
    const quarterly = quarterlyNilai ?? emptySeries();
    const yearly = yearlyNilai ?? emptySeries();

    return {
      id: String(kode),
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: toPkrtShortCode(kode, deskripsi),
      source: "pkrt",
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
    console.error(`Gagal build dataset PKRT untuk ${kode}`, error);
    return null;
  }
};

/**
 * =========================================================
 * PDB
 * nilai       -> ADHB
 * pertumbuhan -> ADHK
 * =========================================================
 */
export const fetchPdbIndicators = async () => {
  const { data } = await api.get(ENDPOINTS.pdb.indikator);
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    kode: Number(item?.kode ?? index + 1),
    deskripsi: String(item?.deskripsi ?? `Komponen ${index + 1}`),
    source: "pdb",
  }));
};

export const fetchPdbQuarterlyNilai = async (kode, jenis = "ADHB") => {
  return fetchFirstWorkingSeriesFromEndpoints({
    endpoints: [ENDPOINTS.pdb.timeseries, ENDPOINTS.pdb.chart],
    configBuilder: () => getPdbParams(kode, jenis),
    normalizer: (payload) =>
      normalizeValuePayload(payload, {
        quarterPeriodNormalization: true,
      }),
  });
};

export const fetchPdbAnnualNilai = async (kode, jenis = "ADHB") => {
  return fetchSingleSeries({
    endpoint: ENDPOINTS.pdb.annual,
    configBuilder: () => getPdbParams(kode, jenis),
    normalizer: normalizeAnnualPayload,
  });
};

export const fetchPdbQuarterlyGrowthByType = async (
  kode,
  jenis = "ADHK",
  canonicalType
) => {
  const requestType = PDB_REQUEST_TYPES.quarterly[canonicalType];
  if (!requestType) return emptySeries();

  return fetchGrowthSeries({
    endpoint: ENDPOINTS.pdb.growthChart,
    configBuilder: (extra) => getPdbParams(kode, jenis, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: true,
    tryWithoutType: false,
  });
};

export const fetchPdbAnnualGrowth = async (kode, jenis = "ADHK") => {
  const requestType = PDB_REQUEST_TYPES.yearly.annual;

  return fetchGrowthSeries({
    endpoint: ENDPOINTS.pdb.growthAnnual,
    configBuilder: (extra) => getPdbParams(kode, jenis, extra),
    canonicalType: requestType,
    quarterPeriodNormalization: false,
    tryWithoutType: true,
  });
};

export const buildPdbDatasetFromApi = async ({
  kode,
  deskripsi,
  measure = "nilai",
}) => {
  try {
    const jenisNilai = measure === "nilai" ? "ADHB" : "ADHK";

    const [quarterlyNilai, yearlyNilai, qtoq, yony, ctoc, annual] =
      await Promise.all([
        safe(() => fetchPdbQuarterlyNilai(kode, jenisNilai)),
        safe(() => fetchPdbAnnualNilai(kode, jenisNilai)),
        safe(() => fetchPdbQuarterlyGrowthByType(kode, "ADHK", "qtoq")),
        safe(() => fetchPdbQuarterlyGrowthByType(kode, "ADHK", "yony")),
        safe(() => fetchPdbQuarterlyGrowthByType(kode, "ADHK", "ctoc")),
        safe(() => fetchPdbAnnualGrowth(kode, "ADHK")),
      ]);

    return {
      id: String(kode),
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: String(kode),
      source: "pdb",
      apiCode: String(kode),
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
    console.error(`Gagal build dataset PDB untuk ${kode}`, error);
    return null;
  }
};

export default api;