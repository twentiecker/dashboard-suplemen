import { defineStore } from "pinia";

export const useChartStore = defineStore("chart", {
  state: () => ({
    selectedDataset: [],
  }),

  actions: {
    setDataset(dataset) {
      this.selectedDataset = dataset;
    },
    addDataset(dataset) {
      const exists = this.selectedDataset.find(
        (d) => d.label === dataset.label,
      );

      if (!exists) {
        this.selectedDataset.push(dataset);
      }
    },
    deleteDataset(dataset) {
      const data = this.selectedDataset.find((d) => d.id === dataset.id);
      const index = this.selectedDataset.indexOf(data);

      if (index !== -1 && this.selectedDataset.length > 1) {
        this.selectedDataset.splice(index, 1);
      }
    },
    setIsAdded(dataset) {
      const data = this.selectedDataset.find((d) => d.id === dataset.id);
      const index = this.selectedDataset.indexOf(data);

      if (index !== -1 && this.selectedDataset.length > 1) {
        this.selectedDataset[index].isAdded =
          !this.selectedDataset[index].isAdded;
      }
    },
    clearDataset() {
      this.selectedDataset = [];
    },
  },
});
