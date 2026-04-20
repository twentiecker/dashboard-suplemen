import { ref, computed, nextTick } from "vue";
import {
  fetchIndicatorsBySource,
  buildDynamicDatasetFromApi,
  buildPdbStaticDatasetFromComponent,
} from "../services/pkrtAPI";
import { mapWithConcurrency } from "../utils/asyncHelpers";
import {
  normalizeTextKey,
} from "../utils/chartHelpers";
import {
  buildPdbComponentMappings,
  isAllowedByComponentRule,
} from "../utils/pdbHelpers";

export function useDataLoader({
  chartStore,
  staticComponent,
  staticMeasure,
  componentRuleMode,
}) {
  const pdbIndicatorOptions = ref([]);
  const activeSource = ref("");
  const activeStaticDatasetRef = ref(null);
  const dynamicIndicatorUnitMap = ref({});
  const cards = ref([]);
  const isLoadingCards = ref(false);

  const dynamicDatasetCache = new Map();
  const staticDatasetCache = new Map();

  const filteredPdbIndicatorOptions = computed(() =>
    pdbIndicatorOptions.value.filter((item) =>
      isAllowedByComponentRule(item, componentRuleMode.value)
    )
  );

  const globalComponentOptions = computed(() =>
    filteredPdbIndicatorOptions.value.map((item) => ({
      label: item?.shortLabel || item?.deskripsi || "",
      fullLabel: item?.isHeader
        ? (item?.fullLabel || item?.deskripsi || "")
        : "",
      value: String(item.kode),
      isHeader: !!item?.isHeader,
    }))
  );

  const activeStaticIndicator = computed(() =>
    filteredPdbIndicatorOptions.value.find(
      (item) => String(item.kode) === String(staticComponent.value)
    ) ?? null
  );

  const activeStaticDataset = computed(() => activeStaticDatasetRef.value ?? null);

  const activeMappedSource = computed(() =>
    String(activeStaticIndicator.value?.mappedSource ?? "")
  );

  const getDynamicCacheKey = ({ source, kode }) =>
    `${String(source).toLowerCase()}-${String(kode)}`;

  const getCachedDynamicDataset = async (item) => {
    const key = getDynamicCacheKey({
      source: item.source,
      kode: item.kode,
    });

    if (dynamicDatasetCache.has(key)) return dynamicDatasetCache.get(key);

    const dataset = await buildDynamicDatasetFromApi({
      source: item.source,
      kode: item.kode,
      deskripsi: item.deskripsi,
      satuan: item.satuan,
    });

    const mergedDataset = dataset
      ? {
          ...dataset,
          kode: dataset?.kode ?? item?.kode ?? "",
          apiCode: dataset?.apiCode ?? item?.kode ?? "",
          sourceCode: dataset?.sourceCode ?? item?.kode ?? "",
          satuan: dataset?.satuan ?? item?.satuan ?? "",
          deskripsi: dataset?.deskripsi ?? item?.deskripsi ?? "",
          indicatorName:
            dataset?.indicatorName ??
            item?.deskripsi ??
            dataset?.deskripsi ??
            "",
          meta: {
            ...(dataset?.meta ?? {}),
            kode: dataset?.meta?.kode ?? item?.kode ?? "",
            satuan: dataset?.meta?.satuan ?? item?.satuan ?? "",
            deskripsi: dataset?.meta?.deskripsi ?? item?.deskripsi ?? "",
          },
        }
      : null;

    if (mergedDataset) {
      dynamicDatasetCache.set(key, mergedDataset);
    }

    return mergedDataset;
  };

  const getCachedStaticDataset = async ({ kode, deskripsi, measure }) => {
    const key = `pdb-static-${String(kode)}-${String(measure)}`;

    if (staticDatasetCache.has(key)) return staticDatasetCache.get(key);

    const dataset = await buildPdbStaticDatasetFromComponent({
      kode,
      deskripsi,
      measure,
    });

    if (dataset) {
      staticDatasetCache.set(key, dataset);
    }

    return dataset;
  };

  const loadPdbComponentOptions = async () => {
    try {
      const indikatorPdb = await fetchIndicatorsBySource("pdb");
      const mapped = buildPdbComponentMappings(indikatorPdb);
      pdbIndicatorOptions.value = mapped;

      const filtered = mapped.filter((item) =>
        isAllowedByComponentRule(item, componentRuleMode.value)
      );

      if (!staticComponent.value && filtered.length) {
        staticComponent.value = String(filtered[0].kode);
      } else if (!filtered.length) {
        staticComponent.value = "";
      }
    } catch (err) {
      console.error("Gagal load indikator PDB", err);
      pdbIndicatorOptions.value = [];
      staticComponent.value = "";
    }
  };

  const loadCardsFromMappedSource = async () => {
    try {
      isLoadingCards.value = true;

      const source = activeMappedSource.value;

      if (!source) {
        cards.value = [];
        activeSource.value = "";
        chartStore.selectedDataset = [];
        await nextTick();
        return;
      }

      activeSource.value = source;

      const indikator = await fetchIndicatorsBySource(source);

      dynamicIndicatorUnitMap.value = indikator.reduce((acc, item) => {
        const unit = String(item?.satuan ?? item?.unit ?? "").trim();
        const kode = String(item?.kode ?? item?.code ?? item?.apiCode ?? "").trim();
        const nama = normalizeTextKey(item?.deskripsi ?? "");

        if (kode) acc[kode] = unit;
        if (nama) acc[`name:${nama}`] = unit;

        return acc;
      }, {});

      const datasets = await mapWithConcurrency(
        indikator.map((item) => ({
          ...item,
          source,
        })),
        async (item) => await getCachedDynamicDataset(item),
        3
      );

      const validDatasets = datasets.filter((item) => item && item.id);
      cards.value = validDatasets;

      if (validDatasets.length) {
        const first = validDatasets[0];

        chartStore.initPrimary(first);
        chartStore.setMeasure(first.id, "nilai");

        if (first?.aggregationAvailability?.allowMonthly) {
          chartStore.setAggregation(first.id, "monthly");
        } else if (first?.aggregationAvailability?.allowQuarterly) {
          chartStore.setAggregation(first.id, "quarterly");
        } else if (first?.aggregationAvailability?.allowYearly) {
          chartStore.setAggregation(first.id, "yearly");
        } else if (
          String(first?.apiFreqPrefix ?? first?.apiCode ?? "")
            .charAt(0)
            .toUpperCase() !== "Q" &&
          first.rawFrequency === "monthly"
        ) {
          chartStore.setAggregation(first.id, "monthly");
        } else if (
          first.rawFrequency === "monthly" ||
          first.rawFrequency === "quarterly"
        ) {
          chartStore.setAggregation(first.id, "quarterly");
        } else {
          chartStore.setAggregation(first.id, "yearly");
        }
      } else {
        cards.value = [];
        chartStore.selectedDataset = [];
      }

      await nextTick();
      await nextTick();
    } catch (err) {
      console.error("Gagal load data source terpilih", err);
      cards.value = [];
      activeSource.value = "";
      chartStore.selectedDataset = [];
    } finally {
      await nextTick();
      isLoadingCards.value = false;
    }
  };

  const loadActiveStaticDataset = async () => {
    try {
      if (!staticComponent.value || !activeStaticIndicator.value) {
        activeStaticDatasetRef.value = null;
        return;
      }

      const dataset = await getCachedStaticDataset({
        kode: activeStaticIndicator.value.kode,
        deskripsi: activeStaticIndicator.value.deskripsi,
        measure: staticMeasure.value,
      });

      activeStaticDatasetRef.value = dataset ?? null;
    } catch (err) {
      console.error("Gagal load dataset statis aktif", err);
      activeStaticDatasetRef.value = null;
    }
  };

  const reloadBySelectedComponent = async () => {
    chartStore.clearAllCompareConfigs();
    staticMeasure.value = "nilai";

    await loadCardsFromMappedSource();
    await loadActiveStaticDataset();

    if (activeStaticDatasetRef.value) {
      if ((activeStaticDatasetRef.value?.derivedPeriods?.quarterly?.length ?? 0) > 0) {
        return {
          staticPeriod: "quarterly",
          staticMethod: "qtoq",
        };
      }

      return {
        staticPeriod: "yearly",
        staticMethod: "annual",
      };
    }

    return {
      staticPeriod: "quarterly",
      staticMethod: "qtoq",
    };
  };

  const resetAllDataState = () => {
    activeStaticDatasetRef.value = null;
    cards.value = [];
    activeSource.value = "";
    chartStore.selectedDataset = [];
  };

  return {
    pdbIndicatorOptions,
    activeSource,
    activeStaticDatasetRef,
    activeStaticDataset,
    activeStaticIndicator,
    activeMappedSource,
    dynamicIndicatorUnitMap,
    cards,
    isLoadingCards,
    filteredPdbIndicatorOptions,
    globalComponentOptions,

    loadPdbComponentOptions,
    loadCardsFromMappedSource,
    loadActiveStaticDataset,
    reloadBySelectedComponent,
    resetAllDataState,
  };
}