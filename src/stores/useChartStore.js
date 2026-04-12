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

const getSupportedAggregations = (dataset) => {
  const rawFrequency = dataset?.rawFrequency ?? "unknown";
  const apiPrefix = String(dataset?.apiFreqPrefix ?? dataset?.apiCode ?? "")
    .charAt(0)
    .toUpperCase();

  return {
    monthly: apiPrefix !== "Q" && rawFrequency === "monthly",
    quarterly: rawFrequency === "monthly" || rawFrequency === "quarterly",
    yearly: true,
  };
};

const adaptConfigToDataset = (dataset, sourceConfig = {}) => {
  const supported = getSupportedAggregations(dataset);

  const measure = sourceConfig?.measure ?? null;
  let aggregation = sourceConfig?.aggregation ?? null;
  let method = sourceConfig?.method ?? null;

  if (aggregation === "monthly" && !supported.monthly) {
    aggregation = supported.quarterly ? "quarterly" : "yearly";
  } else if (aggregation === "quarterly" && !supported.quarterly) {
    aggregation = "yearly";
  } else if (aggregation === "yearly" && !supported.yearly) {
    aggregation = supported.quarterly
      ? "quarterly"
      : supported.monthly
        ? "monthly"
        : null;
  }

  if (measure === "nilai") {
    method = aggregation ? getDefaultMethodByAggregation(aggregation) : null;
  } else if (measure === "pertumbuhan") {
    method = aggregation ? getDefaultMethodByAggregation(aggregation) : null;
  } else {
    method = null;
  }

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
      this.expandedFilterIds = [];
    },

    setPrimary(dataset) {
      this.ensureConfig(dataset);

      const existsIdx = this.selectedDataset.findIndex(
        (d) => String(d.id) === String(dataset.id)
      );

      if (existsIdx !== -1) {
        const picked = this.selectedDataset.splice(existsIdx, 1)[0];
        this.selectedDataset.unshift(picked);
        this.expandedFilterIds = this.expandedFilterIds.filter(
          (id) => id !== String(dataset.id)
        );
        return;
      }

      this.selectedDataset = [dataset];
      this.expandedFilterIds = [];
    },

    addCompare(dataset) {
      this.ensureConfig(dataset);
      const id = String(dataset.id);

      if (this.selectedDataset.length === 0) {
        this.selectedDataset = [dataset];
        this.expandedFilterIds = [];
        return;
      }

      const exists = this.selectedDataset.find((d) => String(d.id) === id);
      if (exists) return;
      if (this.selectedDataset.length >= MAX_DYNAMIC) return;

      const primaryDataset = this.selectedDataset[0] ?? null;
      if (primaryDataset) {
        const primaryConfig = this.getCompareConfig(primaryDataset);
        const inheritedConfig = adaptConfigToDataset(dataset, primaryConfig);

        if (inheritedConfig.measure || inheritedConfig.aggregation || inheritedConfig.method) {
          this.applyConfig(dataset, inheritedConfig);
        }
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

      this.compareConfigs[id].measure = measure;
      this.compareConfigs[id].aggregation = null;
      this.compareConfigs[id].method = null;
    },

    setAggregation(datasetId, aggregation) {
      const id = String(datasetId);
      this.ensureConfig(id);

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