import { ref, nextTick } from "vue";
import { wait } from "../utils/asyncHelpers";

export function useMergeAnimation({
  leftPanelRef,
  rightPanelRef,
  isPageBusy,
  isCombineDisabled,
}) {
  const isGabung = ref(false);
  const isMerging = ref(false);
  const mergePhase = ref("idle");
  const freezeDuration = 160;

  const snapshotPiecesVisible = ref(false);
  const snapshotPieces = ref([]);

  const getRootElement = (target) => {
    if (!target) return null;
    return target.$el ?? target;
  };

  const buildSnapshotPieces = async () => {
    await nextTick();

    const rightRoot = getRootElement(rightPanelRef.value);
    const leftRoot = getRootElement(leftPanelRef.value);

    const canvas = rightRoot?.querySelector?.("canvas");
    const leftBox = leftRoot?.getBoundingClientRect?.();

    if (!canvas || !leftBox) {
      snapshotPieces.value = [];
      return false;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const dataUrl = canvas.toDataURL("image/png");

    const cols = 6;
    const rows = 4;
    const pieceW = canvasRect.width / cols;
    const pieceH = canvasRect.height / rows;

    const targetX = leftBox.left + leftBox.width * 0.28;
    const targetY = leftBox.top + leftBox.height * 0.42;

    const pieces = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;

        const startLeft = canvasRect.left + col * pieceW;
        const startTop = canvasRect.top + row * pieceH;

        const destLeft = targetX + (Math.random() * 120 - 60);
        const destTop = targetY + (Math.random() * 70 - 35);

        const dx = destLeft - startLeft;
        const dy = destTop - startTop;

        const arc = -(60 + Math.random() * 90);
        const rot = `${-90 + Math.random() * 180}deg`;
        const scale = (0.2 + Math.random() * 0.35).toFixed(2);
        const delay = `${index * 18}ms`;

        pieces.push({
          id: `piece-${index}`,
          style: {
            left: `${startLeft}px`,
            top: `${startTop}px`,
            width: `${pieceW + 0.5}px`,
            height: `${pieceH + 0.5}px`,
            backgroundImage: `url("${dataUrl}")`,
            backgroundSize: `${canvasRect.width}px ${canvasRect.height}px`,
            backgroundPosition: `-${col * pieceW}px -${row * pieceH}px`,
            "--dx": `${dx}px`,
            "--dy": `${dy}px`,
            "--arc": `${arc}px`,
            "--rot": rot,
            "--scale": scale,
            "--delay": delay,
          },
        });
      }
    }

    snapshotPieces.value = pieces;
    return true;
  };

  const onToggleGabung = async () => {
    if (isCombineDisabled.value || isPageBusy.value) return;

    if (isGabung.value) {
      isMerging.value = true;
      mergePhase.value = "absorb";
      await new Promise((resolve) => requestAnimationFrame(resolve));
      isGabung.value = false;
      await wait(700);
      mergePhase.value = "idle";
      isMerging.value = false;
      snapshotPiecesVisible.value = false;
      snapshotPieces.value = [];
      return;
    }

    isMerging.value = true;

    mergePhase.value = "lift";
    await wait(240);

    mergePhase.value = "freeze";
    await wait(freezeDuration);

    await buildSnapshotPieces();
    snapshotPiecesVisible.value = true;

    mergePhase.value = "transfer";
    await wait(620);

    isGabung.value = true;

    await nextTick();
    mergePhase.value = "absorb";
    await wait(520);

    snapshotPiecesVisible.value = false;
    snapshotPieces.value = [];
    mergePhase.value = "idle";
    isMerging.value = false;
  };

  return {
    isGabung,
    isMerging,
    mergePhase,
    freezeDuration,
    snapshotPiecesVisible,
    snapshotPieces,
    buildSnapshotPieces,
    onToggleGabung,
  };
}