import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
});

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const parsePeriod = (period) => {
  const text = String(period ?? "").trim().toUpperCase();

  let m = text.match(/^(\d{4})M(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    return {
      raw: text,
      type: "monthly",
      year,
      month,
      quarter: Math.ceil(month / 3),
      order: year * 100 + month,
    };
  }

  m = text.match(/^(\d{4})Q([1-4])$/);
  if (m) {
    const year = Number(m[1]);
    const quarter = Number(m[2]);
    return {
      raw: text,
      type: "quarterly",
      year,
      quarter,
      month: quarter * 3,
      order: year * 10 + quarter,
    };
  }

  m = text.match(/^(\d{4})$/);
  if (m) {
    const year = Number(m[1]);
    return {
      raw: text,
      type: "yearly",
      year,
      order: year,
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

const inferFrequencyFromPeriods = (periods = []) => {
  const sample = String(periods?.[0] ?? "").toUpperCase();
  if (sample.includes("Q")) return "quarterly";
  if (sample.includes("M")) return "monthly";
  return "monthly";
};

const pickPeriods = (payload) => {
  if (Array.isArray(payload?.xAxis)) return payload.xAxis;
  if (Array.isArray(payload?.labels)) return payload.labels;
  if (Array.isArray(payload?.periode)) return payload.periode;
  if (Array.isArray(payload?.periods)) return payload.periods;

  if (Array.isArray(payload?.data) && payload.data.length && typeof payload.data[0] === "object") {
    return payload.data
      .map(
        (item) =>
          item?.periode ??
          item?.period ??
          item?.label ??
          item?.x ??
          null
      )
      .filter(Boolean);
  }

  return [];
};

const pickSeriesData = (payload) => {
  if (Array.isArray(payload?.series) && Array.isArray(payload.series[0]?.data)) {
    return payload.series[0].data.map(toNumberOrNull);
  }

  if (Array.isArray(payload?.data)) {
    if (payload.data.length && typeof payload.data[0] === "object") {
      return payload.data.map((item) =>
        toNumberOrNull(
          item?.pertumbuhan ??
          item?.growth ??
          item?.persentase ??
          item?.percentage ??
          item?.rate ??
          item?.nilai ??
          item?.value ??
          item?.data ??
          item?.jumlah ??
          item?.y
        )
      );
    }

    return payload.data.map(toNumberOrNull);
  }

  if (Array.isArray(payload?.values)) {
    return payload.values.map(toNumberOrNull);
  }

  return [];
};

const normalizeChartPayload = (payload) => {
  const periods = pickPeriods(payload);
  const data = pickSeriesData(payload);

  return {
    periods,
    data,
    frequency: inferFrequencyFromPeriods(periods),
  };
};

const sortPairsByPeriod = (periods = [], data = []) => {
  return periods
    .map((period, index) => ({ period: String(period ?? ""), value: toNumberOrNull(data[index]) }))
    .filter((item) => item.period)
    .sort((a, b) => parsePeriod(a.period).order - parsePeriod(b.period).order);
};

const monthlyToQuarterly = (monthly = [], periods = []) => {
  const outData = [];
  const outPeriods = [];

  periods.forEach((period, index) => {
    const parsed = parsePeriod(period);
    if (parsed.type === "monthly" && [3, 6, 9, 12].includes(parsed.month)) {
      outData.push(toNumberOrNull(monthly[index]));
      outPeriods.push(`${parsed.year}Q${parsed.quarter}`);
    }
  });

  return { data: outData, periods: outPeriods };
};

const calcGrowthSeries = (data = [], periods = [], mode = "mtm") => {
  const out = new Array(data.length).fill(null);
  const parsed = periods.map(parsePeriod);

  const cumulativeMap = new Map();

  for (let i = 0; i < data.length; i += 1) {
    const current = toNumberOrNull(data[i]);
    const p = parsed[i];

    if (current === null || !p?.year) continue;

    const cumulativeKey = `${p.type}-${p.year}`;
    const prevCumulative = cumulativeMap.get(cumulativeKey) ?? 0;
    const nextCumulative = prevCumulative + current;
    cumulativeMap.set(cumulativeKey, nextCumulative);

    let compareIndex = -1;
    let numerator = current;
    let denominator = null;

    if (mode === "mtm") {
      compareIndex = i - 1;
    } else if (mode === "yoy") {
      const targetPeriod =
        p.type === "monthly"
          ? `${p.year - 1}M${String(p.month).padStart(2, "0")}`
          : `${p.year - 1}Q${p.quarter}`;
      compareIndex = periods.findIndex((period) => String(period).toUpperCase() === targetPeriod);
    } else if (mode === "ctc" || mode === "ytd") {
      const previousYearKey = `${p.type}-${p.year - 1}`;
      numerator = nextCumulative;
      denominator = cumulativeMap.get(previousYearKey) ?? null;
    }

    if (mode === "mtm" || mode === "yoy") {
      denominator = compareIndex >= 0 ? toNumberOrNull(data[compareIndex]) : null;
    }

    if (denominator === null || denominator === 0) continue;

    out[i] = Number((((numerator - denominator) / denominator) * 100).toFixed(2));
  }

  return out;
};

const buildGrowthPayload = (data = [], periods = [], mode = "mtm") => ({
  data: calcGrowthSeries(data, periods, mode),
  periods: [...periods],
});

export const fetchPkrtIndicators = async () => {
  const { data } = await api.get("/api/v1/pkrt/indikator");

  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    kode: String(item?.kode ?? `PKRT-${index + 1}`),
    deskripsi: String(item?.deskripsi ?? item?.kode ?? `Indikator ${index + 1}`),
  }));
};

export const fetchPkrtChartData = async (kode) => {
  const { data } = await api.get("/api/v1/pkrt/chart", {
    params: { kode },
  });
  return data;
};

const safeNormalize = async (fetcher) => {
  try {
    const payload = await fetcher();
    return normalizeChartPayload(payload);
  } catch (error) {
    return {
      periods: [],
      data: [],
      frequency: "monthly",
    };
  }
};

export const buildDatasetFromApi = async ({ kode, deskripsi }) => {
  try {
    const basePayload = await fetchPkrtChartData(kode);
    const base = normalizeChartPayload(basePayload);
    const sortedBase = sortPairsByPeriod(base.periods, base.data);

    const basePeriods = sortedBase.map((item) => item.period);
    const baseValues = sortedBase.map((item) => item.value);
    const rawFrequency = inferFrequencyFromPeriods(basePeriods);

    let monthly = [];
    let monthlyPeriods = [];
    let quarterly = [];
    let quarterlyPeriods = [];

    if (rawFrequency === "monthly") {
      monthly = baseValues;
      monthlyPeriods = basePeriods;
      const quarterlyConverted = monthlyToQuarterly(monthly, monthlyPeriods);
      quarterly = quarterlyConverted.data;
      quarterlyPeriods = quarterlyConverted.periods;
    } else {
      quarterly = baseValues;
      quarterlyPeriods = basePeriods;
    }

    const growth = {
      monthly: {
        mtm: buildGrowthPayload(monthly, monthlyPeriods, "mtm"),
        yoy: buildGrowthPayload(monthly, monthlyPeriods, "yoy"),
        ytd: buildGrowthPayload(monthly, monthlyPeriods, "ytd"),
      },
      quarterly: {
        qtq: buildGrowthPayload(quarterly, quarterlyPeriods, "mtm"),
        yoy: buildGrowthPayload(quarterly, quarterlyPeriods, "yoy"),
        ctc: buildGrowthPayload(quarterly, quarterlyPeriods, "ctc"),
      },
    };

    return {
      id: String(kode),
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: String(kode),
      rawFrequency,
      periods: rawFrequency === "monthly" ? monthlyPeriods : quarterlyPeriods,
      derivedPeriods: {
        monthly: monthlyPeriods,
        quarterly: quarterlyPeriods,
      },
      series: {
        monthly,
        quarterly,
      },
      growth,
      tension: 0.4,
    };
  } catch (error) {
    console.warn(`Gagal build dataset untuk ${kode}`, error);

    return {
      id: String(kode),
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: String(kode),
      rawFrequency: "monthly",
      periods: [],
      derivedPeriods: {
        monthly: [],
        quarterly: [],
      },
      series: {
        monthly: [],
        quarterly: [],
      },
      growth: {
        monthly: {
          mtm: { data: [], periods: [] },
          yoy: { data: [], periods: [] },
          ytd: { data: [], periods: [] },
        },
        quarterly: {
          qtq: { data: [], periods: [] },
          yoy: { data: [], periods: [] },
          ctc: { data: [], periods: [] },
        },
      },
      tension: 0.4,
    };
  }
};

export default api;
