import { defineStore } from "pinia";

const MAX_DYNAMIC = 5;
const MAX_SAVE_SLOT = 2;

function createDefaultConfig() {
  return {
    measure: null,
    aggregation: null, // monthly | quarterly | yearly
    method: null, // mtom | yony | ytod | qtoq | ctoc | annual
    displayUnit: null, // khusus tampilan nilai rupiah
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
  displayUnit: config?.displayUnit ?? null,
});

const deepClone = (value) => JSON.parse(JSON.stringify(value));

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
    displayUnit: null,
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

    /**
     * KHUSUS KONVERSI RUPIAH:
     * displayUnit tidak boleh inherit dari indikator sebelumnya.
     * Default displayUnit akan ditentukan oleh App.vue berdasarkan satuan asli data.
     */
    displayUnit: null,
  };
};

export const useChartStore = defineStore("chart", {
  state: () => ({
    selectedDataset: [],
    compareConfigs: {},
    expandedFilterIds: [],
    savedIndicatorStates: {},
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
    getSavedSlotsByDatasetId: (state) => (datasetId) => {
      const id = String(datasetId ?? "");
      return state.savedIndicatorStates[id] ?? {};
    },
    hasSavedSlot: (state) => (datasetId, slot) => {
      const id = String(datasetId ?? "");
      const slotKey = `slot${Number(slot)}`;
      return !!state.savedIndicatorStates?.[id]?.[slotKey];
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

        const inheritedConfig = adaptConfigToDataset(
          dataset,
          fallbackPrimaryConfig
        );

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

      if (measure !== "nilai") {
        this.compareConfigs[id].displayUnit = null;
      }
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

    setDisplayUnit(datasetId, displayUnit) {
      const id = String(datasetId);
      this.ensureConfig(id);

      this.compareConfigs[id].displayUnit = displayUnit ?? null;
    },

    resetCompareConfig(datasetId) {
      const id = String(datasetId);
      this.compareConfigs[id] = createDefaultConfig();
    },

    clearAllCompareConfigs() {
      this.compareConfigs = {};
    },

    saveIndicatorState(datasetId, payload = {}) {
      const id = String(datasetId ?? "");
      const slotNumber = Number(payload?.slot);

      if (!id) return false;
      if (![1, 2].includes(slotNumber)) return false;
      if (slotNumber > MAX_SAVE_SLOT) return false;

      const slotKey = `slot${slotNumber}`;
      const currentConfig = this.compareConfigs[id] ?? createDefaultConfig();
      const existingSlot = this.savedIndicatorStates?.[id]?.[slotKey] ?? null;

      if (!this.savedIndicatorStates[id]) {
        this.savedIndicatorStates[id] = {};
      }

      this.savedIndicatorStates[id][slotKey] = deepClone({
        savedAt: Date.now(),
        customName:
          String(payload?.customName ?? "").trim() ||
          existingSlot?.customName ||
          `Preset ${slotNumber}`,
        dynamicConfig: cloneConfig(currentConfig),
        uiState: {
          selectedRange: payload?.uiState?.selectedRange ?? "8Y",
          selectedProvince: payload?.uiState?.selectedProvince ?? "indonesia",
          dynamicChartType: payload?.uiState?.dynamicChartType ?? "line",
          combineBarMode: payload?.uiState?.combineBarMode ?? "standard",
        },
        staticState: {
          staticComponent: payload?.staticState?.staticComponent ?? "",
          staticMeasure: payload?.staticState?.staticMeasure ?? "pertumbuhan",
          staticPeriod: payload?.staticState?.staticPeriod ?? "",
          staticMethod: payload?.staticState?.staticMethod ?? "",
          staticChartType: payload?.staticState?.staticChartType ?? "line",
          staticDisplayUnit: payload?.staticState?.staticDisplayUnit ?? "",
        },
      });

      return true;
    },

    loadIndicatorState(datasetId, slot) {
      const id = String(datasetId ?? "");
      const slotNumber = Number(slot);

      if (!id) return null;
      if (![1, 2].includes(slotNumber)) return null;

      const slotKey = `slot${slotNumber}`;
      const saved = this.savedIndicatorStates?.[id]?.[slotKey];

      if (!saved) return null;

      return deepClone(saved);
    },

    renameSavedIndicatorState(datasetId, slot, customName) {
      const id = String(datasetId ?? "");
      const slotNumber = Number(slot);

      if (!id) return false;
      if (![1, 2].includes(slotNumber)) return false;

      const slotKey = `slot${slotNumber}`;
      const saved = this.savedIndicatorStates?.[id]?.[slotKey];

      if (!saved) return false;

      const nextName = String(customName ?? "").trim() || `Preset ${slotNumber}`;
      this.savedIndicatorStates[id][slotKey].customName = nextName;

      return true;
    },

    clearSavedIndicatorState(datasetId, slot) {
      const id = String(datasetId ?? "");
      const slotNumber = Number(slot);

      if (!id) return false;
      if (![1, 2].includes(slotNumber)) return false;

      const slotKey = `slot${slotNumber}`;

      if (!this.savedIndicatorStates?.[id]?.[slotKey]) {
        return false;
      }

      delete this.savedIndicatorStates[id][slotKey];

      if (Object.keys(this.savedIndicatorStates[id]).length === 0) {
        delete this.savedIndicatorStates[id];
      }

      return true;
    },
  },
});