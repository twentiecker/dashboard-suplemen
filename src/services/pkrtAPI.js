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

export const fetchPkrtIndicators = async () => {
  const { data } = await api.get("/api/v1/pkrt/indikator");

  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    kode: String(item?.kode ?? `PKRT-${index + 1}`),
    deskripsi: String(item?.deskripsi ?? item?.kode ?? `Indikator ${index + 1}`),
  }));
};

const inferFrequencyFromPeriods = (periods = []) => {
  const sample = String(periods?.[0] ?? "").toUpperCase();
  if (sample.includes("Q")) return "quarterly";
  if (sample.includes("M")) return "monthly";
  return "monthly";
};

const monthlyToQuarterly = (monthly = []) => {
  const out = [];
  for (let i = 2; i < monthly.length; i += 3) {
    out.push(monthly[i] ?? null);
  }
  return out;
};

const pickPeriods = (payload) => {
  if (Array.isArray(payload?.xAxis)) return payload.xAxis;
  if (Array.isArray(payload?.labels)) return payload.labels;
  if (Array.isArray(payload?.periode)) return payload.periode;
  if (Array.isArray(payload?.periods)) return payload.periods;
  return [];
};

const pickSeriesData = (payload) => {
  if (Array.isArray(payload?.series) && Array.isArray(payload.series[0]?.data)) {
    return payload.series[0].data;
  }

  if (Array.isArray(payload?.data)) {
    if (payload.data.length && typeof payload.data[0] === "object") {
      return payload.data.map((item) => {
        return toNumberOrNull(
          item?.nilai ??
          item?.value ??
          item?.data ??
          item?.jumlah
        );
      });
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

export const fetchPkrtChartData = async (kode) => {
  const { data } = await api.get("/api/v1/pkrt/chart", {
    params: { kode },
  });
  return data;
};

export const buildDatasetFromApi = async ({ kode, deskripsi }) => {
  try {
    const basePayload = await fetchPkrtChartData(kode);
    const base = normalizeChartPayload(basePayload);

    let monthly = [];
    let quarterly = [];
    let rawFrequency = "monthly";

    if (base.data.length > 0) {
      rawFrequency = base.frequency;

      if (base.frequency === "monthly") {
        monthly = base.data;
        quarterly = monthlyToQuarterly(base.data);
      } else {
        quarterly = base.data;
      }
    }

    return {
      id: String(kode),
      label: String(kode),
      indicatorName: String(deskripsi),
      groupCode: String(kode),
      rawFrequency,
      periods: base.periods,
      series: {
        monthly,
        quarterly,
      },
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
      series: {
        monthly: [],
        quarterly: [],
      },
      tension: 0.4,
    };
  }
};

export default api;