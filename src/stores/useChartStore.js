import { defineStore } from "pinia";

const MAX_DYNAMIC = 5;

function createDefaultConfig() {
  return {
    measure: null,
    aggregation: null,
    method: null,
  };
}

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
    ensureConfig(dataset) {
      const id = String(dataset.id);
      if (!this.compareConfigs[id]) {
        this.compareConfigs[id] = createDefaultConfig();
      }
    },

    initPrimary(dataset) {
      this.ensureConfig(dataset);
      this.selectedDataset = [dataset];
    },

    viewOnly(dataset) {
      this.ensureConfig(dataset);
      this.selectedDataset = [dataset];
    },

    setPrimary(dataset) {
      this.ensureConfig(dataset);

      const existsIdx = this.selectedDataset.findIndex(
        (d) => String(d.id) === String(dataset.id)
      );

      if (existsIdx !== -1) {
        const picked = this.selectedDataset.splice(existsIdx, 1)[0];
        this.selectedDataset.unshift(picked);
        return;
      }

      if (this.selectedDataset.length >= MAX_DYNAMIC) return;

      this.selectedDataset = [dataset];
    },

    addCompare(dataset) {
      this.ensureConfig(dataset);

      if (this.selectedDataset.length === 0) {
        this.selectedDataset = [dataset];
      } else {
        const exists = this.selectedDataset.find(
          (d) => String(d.id) === String(dataset.id)
        );
        if (exists) return;
        if (this.selectedDataset.length >= MAX_DYNAMIC) return;

        this.selectedDataset.push(dataset);
      }

      this.expandFilters(dataset.id);
    },

    removeSelected(dataset) {
      const idx = this.selectedDataset.findIndex(
        (d) => String(d.id) === String(dataset.id)
      );
      if (idx === -1) return;
      if (this.selectedDataset.length === 1) return;

      this.selectedDataset.splice(idx, 1);
      this.collapseFilters(dataset.id);
    },

    toggleCompare(dataset) {
      if (this.isSelected(dataset.id)) {
        this.removeSelected(dataset);
      } else {
        this.addCompare(dataset);
      }
    },

    expandFilters(id) {
      const key = String(id);
      if (!this.expandedFilterIds.includes(key)) {
        this.expandedFilterIds.push(key);
      }
    },

    collapseFilters(id) {
      const key = String(id);
      this.expandedFilterIds = this.expandedFilterIds.filter((x) => x !== key);
    },

    setMeasure(datasetId, measure, dataset) {
      const id = String(datasetId);
      if (!this.compareConfigs[id]) {
        this.compareConfigs[id] = createDefaultConfig();
      }

      this.compareConfigs[id].measure = measure;
      this.compareConfigs[id].aggregation = null;
      this.compareConfigs[id].method = null;
    },

    setAggregation(datasetId, aggregation, dataset) {
      const id = String(datasetId);
      if (!this.compareConfigs[id]) {
        this.compareConfigs[id] = createDefaultConfig();
      }

      this.compareConfigs[id].aggregation = aggregation;
      this.compareConfigs[id].method = null;
    },

    setMethod(datasetId, method, dataset) {
      const id = String(datasetId);
      if (!this.compareConfigs[id]) {
        this.compareConfigs[id] = createDefaultConfig();
      }

      this.compareConfigs[id].method = method;
    },
  },
});