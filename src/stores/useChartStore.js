import { defineStore } from "pinia";

const MAX_DYNAMIC = 5;

function createDefaultConfig() {
  return {
    measure: null,
    aggregation: null, // monthly | quarterly | yearly
    method: null, // mtom | yony | ytod | qtoq | ctoc | annual
  };
}

const getDefaultMethodByAggregation = (aggregation) => {
  switch (aggregation) {
    case "monthly":
      return "mtom";
    case "quarterly":
      return "qtoq";
    case "yearly":
      return "annual";
    default:
      return null;
  }
};

const cloneConfig = (config = {}) => ({
  measure: config?.measure ?? null,
  aggregation: config?.aggregation ?? null,
  method: config?.method ?? null,
});

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const hasValidSeriesData = (seriesLike) => {
  const data = Array.isArray(seriesLike?.data) ? seriesLike.data : [];
  return data.some((value) => isFiniteNumber(value));
};

const hasValidArrayData = (arr = []) =>
  Array.isArray(arr) && arr.some((value) => isFiniteNumber(value));

const hasAggregationData = (dataset, aggregation, measure = "nilai") => {
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

  // pertumbuhan
  if (aggregation === "monthly") {
    return (
      hasValidSeriesData(dataset?.growth?.monthly?.mtom) ||
      hasValidSeriesData(dataset?.growth?.monthly?.yony_m) ||
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

const getSupportedAggregations = (dataset, measure = "nilai") => {
  return {
    monthly: hasAggregationData(dataset, "monthly", measure),
    quarterly: hasAggregationData(dataset, "quarterly", measure),
    yearly: hasAggregationData(dataset, "yearly", measure),
  };
};

const getPreferredAggregation = (dataset, measure = "nilai") => {
  const supported = getSupportedAggregations(dataset, measure);

  if (supported.monthly) return "monthly";
  if (supported.quarterly) return "quarterly";
  if (supported.yearly) return "yearly";
  return null;
};

const buildDefaultConfigForDataset = (dataset, measure = "nilai") => {
  const aggregation = getPreferredAggregation(dataset, measure);

  return {
    measure,
    aggregation,
    method: aggregation ? getDefaultMethodByAggregation(aggregation) : null,
  };
};

const adaptConfigToDataset = (dataset, sourceConfig = {}) => {
  const measure = sourceConfig?.measure ?? "nilai";
  const supported = getSupportedAggregations(dataset, measure);

  let aggregation = sourceConfig?.aggregation ?? null;
  let method = sourceConfig?.method ?? null;

  if (aggregation === "monthly" && !supported.monthly) {
    aggregation = supported.quarterly
      ? "quarterly"
      : supported.yearly
        ? "yearly"
        : null;
  } else if (aggregation === "quarterly" && !supported.quarterly) {
    aggregation = supported.monthly
      ? "monthly"
      : supported.yearly
        ? "yearly"
        : null;
  } else if (aggregation === "yearly" && !supported.yearly) {
    aggregation = supported.quarterly
      ? "quarterly"
      : supported.monthly
        ? "monthly"
        : null;
  }

  if (!aggregation) {
    aggregation = getPreferredAggregation(dataset, measure);
  }

  method = aggregation ? getDefaultMethodByAggregation(aggregation) : null;

  return {
    measure,
    aggregation,
    method,
  };
};

export const useChartStore = defineStore("chart", {
  state: () => ({
    selectedDataset: [],
    compareConfigs: {},
    expandedFilterIds: [],
  }),

  getters: {
    isLocked: (state) => state.selectedDataset.length >= MAX_DYNAMIC,
    isSelected: (state) => (id) =>
      state.selectedDataset.some((d) => String(d.id) === String(id)),
    isExpanded: (state) => (id) =>
      state.expandedFilterIds.includes(String(id)),
    primaryId: (state) => state.selectedDataset?.[0]?.id ?? null,
    selectedCount: (state) => state.selectedDataset.length,
    getCompareConfig: (state) => (dataset) => {
      const id = String(dataset?.id ?? "");
      return state.compareConfigs[id] ?? createDefaultConfig();
    },
  },

  actions: {
    ensureConfig(datasetOrId) {
      const id =
        typeof datasetOrId === "object"
          ? String(datasetOrId?.id ?? "")
          : String(datasetOrId ?? "");

      if (!id) return;

      if (!this.compareConfigs[id]) {
        this.compareConfigs[id] = createDefaultConfig();
      }
    },

    applyConfig(datasetOrId, config) {
      const id =
        typeof datasetOrId === "object"
          ? String(datasetOrId?.id ?? "")
          : String(datasetOrId ?? "");

      if (!id) return;

      this.compareConfigs[id] = cloneConfig(config);
    },

    initPrimary(dataset) {
      this.ensureConfig(dataset);
      this.selectedDataset = [dataset];
      this.applyConfig(dataset, buildDefaultConfigForDataset(dataset, "nilai"));
      this.expandedFilterIds = [];
    },

    setPrimary(dataset) {
      this.ensureConfig(dataset);

      const id = String(dataset.id);
      const defaultConfig = buildDefaultConfigForDataset(dataset, "nilai");

      const existsIdx = this.selectedDataset.findIndex(
        (d) => String(d.id) === id
      );

      if (existsIdx !== -1) {
        const picked = this.selectedDataset.splice(existsIdx, 1)[0];
        this.selectedDataset.unshift(picked);
        this.applyConfig(id, defaultConfig);
        this.expandedFilterIds = this.expandedFilterIds.filter(
          (itemId) => itemId !== id
        );
        return;
      }

      this.selectedDataset = [dataset];
      this.applyConfig(id, defaultConfig);
      this.expandedFilterIds = [];
    },

    showOnly(dataset) {
  this.ensureConfig(dataset);

  const id = String(dataset.id);
  const defaultConfig = buildDefaultConfigForDataset(dataset, "nilai");

  this.selectedDataset = [dataset];
  this.applyConfig(id, defaultConfig);
  this.expandedFilterIds = [];
},

    addCompare(dataset) {
      this.ensureConfig(dataset);
      const id = String(dataset.id);

      if (this.selectedDataset.length === 0) {
        this.selectedDataset = [dataset];
        this.applyConfig(id, buildDefaultConfigForDataset(dataset, "nilai"));
        this.expandedFilterIds = [];
        return;
      }

      const exists = this.selectedDataset.find((d) => String(d.id) === id);
      if (exists) return;
      if (this.selectedDataset.length >= MAX_DYNAMIC) return;

      const primaryDataset = this.selectedDataset[0] ?? null;
      if (primaryDataset) {
        const primaryConfig = this.getCompareConfig(primaryDataset);
        const fallbackPrimaryConfig =
          primaryConfig?.measure && primaryConfig?.aggregation
            ? primaryConfig
            : buildDefaultConfigForDataset(primaryDataset, "nilai");

        const inheritedConfig = adaptConfigToDataset(dataset, fallbackPrimaryConfig);
        this.applyConfig(dataset, inheritedConfig);
      } else {
        this.applyConfig(dataset, buildDefaultConfigForDataset(dataset, "nilai"));
      }

      this.selectedDataset.push(dataset);

      if (!this.expandedFilterIds.includes(id)) {
        this.expandedFilterIds.push(id);
      }
    },

    removeSelected(dataset) {
      const id = String(dataset.id);
      const idx = this.selectedDataset.findIndex((d) => String(d.id) === id);
      if (idx === -1) return;
      if (this.selectedDataset.length === 1) return;

      this.selectedDataset.splice(idx, 1);
      this.expandedFilterIds = this.expandedFilterIds.filter((x) => x !== id);
    },

    toggleCompare(dataset) {
      if (this.isSelected(dataset.id)) {
        this.removeSelected(dataset);
      } else {
        this.addCompare(dataset);
      }
    },

setMeasure(datasetId, measure) {
  const id = String(datasetId);
  this.ensureConfig(id);

  const dataset = this.selectedDataset.find((item) => String(item.id) === id);
  const aggregation = getPreferredAggregation(dataset, measure);

  this.compareConfigs[id].measure = measure;
  this.compareConfigs[id].aggregation = aggregation;
  this.compareConfigs[id].method = aggregation
    ? getDefaultMethodByAggregation(aggregation)
    : null;
},

setAggregation(datasetId, aggregation) {
  const id = String(datasetId);
  this.ensureConfig(id);

  const dataset = this.selectedDataset.find((item) => String(item.id) === id);
  const measure = this.compareConfigs[id]?.measure ?? "nilai";
  const supported = getSupportedAggregations(dataset, measure);

  if (!supported?.[aggregation]) return;

  this.compareConfigs[id].aggregation = aggregation;
  this.compareConfigs[id].method = getDefaultMethodByAggregation(aggregation);
},

    setMethod(datasetId, method) {
      const id = String(datasetId);
      this.ensureConfig(id);

      this.compareConfigs[id].method = method;
    },

    resetCompareConfig(datasetId) {
      const id = String(datasetId);
      this.compareConfigs[id] = createDefaultConfig();
    },

    clearAllCompareConfigs() {
      this.compareConfigs = {};
    },
  },
});