import { defineStore } from "pinia";

const MAX_DYNAMIC = 5; 

export const useChartStore = defineStore("chart", {
  state: () => ({
    selectedDataset: [],
  }),

  getters: {
    isLocked: (state) => state.selectedDataset.length >= MAX_DYNAMIC,
    isSelected: (state) => (id) => state.selectedDataset.some((d) => String(d.id) === String(id)),
    primaryId: (state) => state.selectedDataset?.[0]?.id ?? null,
    selectedCount: (state) => state.selectedDataset.length,
  },

  actions: {
    initPrimary(dataset) {
      this.selectedDataset = [dataset];
    },

    viewOnly(dataset) {
      this.selectedDataset = [dataset];
    },

    setPrimary(dataset) {
      const existsIdx = this.selectedDataset.findIndex((d) => String(d.id) === String(dataset.id));

      if (existsIdx !== -1) {
        const picked = this.selectedDataset.splice(existsIdx, 1)[0];
        this.selectedDataset.unshift(picked);
        return;
      }

      if (this.selectedDataset.length >= MAX_DYNAMIC) return;

      this.selectedDataset = [dataset];
    },

    addCompare(dataset) {
      if (this.selectedDataset.length === 0) {
        this.selectedDataset = [dataset];
        return;
      }

      const exists = this.selectedDataset.find((d) => String(d.id) === String(dataset.id));
      if (exists) return;

      if (this.selectedDataset.length >= MAX_DYNAMIC) return;

      this.selectedDataset.push(dataset);
    },

    removeSelected(dataset) {
      const idx = this.selectedDataset.findIndex((d) => String(d.id) === String(dataset.id));
      if (idx === -1) return;

      if (this.selectedDataset.length === 1) return;

      this.selectedDataset.splice(idx, 1);
    },
  },
});