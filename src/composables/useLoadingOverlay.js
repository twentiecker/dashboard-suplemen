import { ref } from "vue";

export const useLoadingOverlay = ({ stages = [], wait }) => {
  const loadingStageText = ref("Menyiapkan visual...");
  const loadingProgressText = ref("Menyelaraskan data dan tampilan");
  const loadingPulseKey = ref(0);
  const loadingPercent = ref(0);

  let loadingStageTimer = null;
  let loadingPercentTimer = null;

  const startLoadingStageAnimation = () => {
    let index = 0;

    if (!stages.length) return;

    loadingStageText.value = stages[0].title;
    loadingProgressText.value = stages[0].subtitle;
    loadingPulseKey.value += 1;
    loadingPercent.value = 0;

    if (loadingStageTimer) clearInterval(loadingStageTimer);
    if (loadingPercentTimer) clearInterval(loadingPercentTimer);

    loadingStageTimer = setInterval(() => {
      index = (index + 1) % stages.length;
      loadingStageText.value = stages[index].title;
      loadingProgressText.value = stages[index].subtitle;
      loadingPulseKey.value += 1;
    }, 1100);

    loadingPercentTimer = setInterval(() => {
      const current = loadingPercent.value;

      if (current < 35) {
        loadingPercent.value += 3;
        return;
      }

      if (current < 65) {
        loadingPercent.value += 2;
        return;
      }

      if (current < 88) {
        loadingPercent.value += 1;
        return;
      }

      if (current < 93) {
        loadingPercent.value += 0.3;
      }
    }, 90);
  };

  const finishLoadingStageAnimation = async () => {
    if (loadingPercentTimer) {
      clearInterval(loadingPercentTimer);
      loadingPercentTimer = null;
    }

    while (loadingPercent.value < 100) {
      loadingPercent.value = Math.min(100, loadingPercent.value + 4);
      await wait(18);
    }
  };

  const stopLoadingStageAnimation = () => {
    if (loadingStageTimer) {
      clearInterval(loadingStageTimer);
      loadingStageTimer = null;
    }

    if (loadingPercentTimer) {
      clearInterval(loadingPercentTimer);
      loadingPercentTimer = null;
    }
  };

  return {
    loadingStageText,
    loadingProgressText,
    loadingPulseKey,
    loadingPercent,
    startLoadingStageAnimation,
    finishLoadingStageAnimation,
    stopLoadingStageAnimation,
  };
};