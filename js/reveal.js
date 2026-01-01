import { delay, repositionField } from "./util.js";

// Konstanten für die Reveal-Animation
const ANIMATION_DURATION = 250; // ms für Repositionierung
const SCORE_REVEAL_DELAY = 250; // ms zwischen Score-Anzeigen
const PAUSE_BEFORE_SORT = 250; // ms Pause bevor Sortierung beginnt

// Holt die Global Averages vom Backend
async function fetchGlobalAverages() {
  try {
    const response = await fetch("backend/send-global-average.php");
    if (!response.ok) return null;
    const data = await response.json();
    return data.items || {};
  } catch (e) {
    console.error("Fehler beim Abrufen der Global Averages:", e);
    return null;
  }
}

// Extrahiert den Dateinamen aus einem Bildpfad (mit Wildcard für Größenvarianten)
function getFilename(path) {
  return (
    path
      ?.replace(/__(1024|512|256)__/, "__**__")
      .split("/")
      .pop() || ""
  );
}

// Führt die Reveal-Animation durch:
// 1. Zeigt Global Averages an
// 2. Sortiert die Items entsprechend ihrer Global Average Position
export async function revealAnimation(board) {
  const globalAverages = await fetchGlobalAverages();
  if (!globalAverages) {
    console.warn(
      "Keine Global Averages verfügbar, überspringe Reveal-Animation"
    );
    return;
  }

  const container = document.getElementById("item-container");

  // Zeige Scores nacheinander an (Position 1-10)
  for (let i = 0; i < 10; i++) {
    const src = container.children[i]
      ?.querySelector(".item-box img")
      ?.getAttribute("src");
    const filename = getFilename(src);
    const score = globalAverages[filename]?.["global-average"] || 0;
    if (score >= 1) {
      const numElement =
        container.children[i]?.querySelector(".item-box-number");
      if (numElement) numElement.innerText = score;
    }
    await delay(SCORE_REVEAL_DELAY);
  }

  await delay(PAUSE_BEFORE_SORT);

  // Sortierung durchführen mit Selection Sort Algorithmus
  // Wir iterieren von Position 0 bis Ende und platzieren jeweils das Element
  // mit dem kleinsten Score an die aktuelle Position
  for (let targetPos = 0; targetPos < 10; targetPos++) {
    // Finde das Element mit dem kleinsten Score ab Position targetPos
    let minScore = Infinity;
    let minPos = -1;

    const children = Array.from(container.children);
    for (let i = targetPos; i < children.length; i++) {
      const src = children[i]
        .querySelector(".item-box img")
        ?.getAttribute("src");
      const filename = getFilename(src);
      const scoreData = globalAverages[filename]?.["global-average"];

      // Überspringe Items ohne gültigen Score (Score muss >= 1 sein)
      if (scoreData === undefined || scoreData === null || scoreData < 1) {
        continue;
      }

      const score = scoreData;

      if (score < minScore) {
        minScore = score;
        minPos = i;
      }
    }

    if (minPos !== -1 && minPos !== targetPos) {
      repositionField(container.children, targetPos, minPos);
      await delay(ANIMATION_DURATION);
    }
  }
}

// Setzt die Nummern-Anzeige auf die ursprünglichen Werte (1-10) zurück
export function resetNumberDisplays() {
  document.querySelectorAll(".item-box-number").forEach((el, i) => {
    el.innerText = i + 1;
  });
}

// Setzt die DOM-Reihenfolge der Container auf die ursprüngliche Reihenfolge (0-9) zurück
export function resetContainerOrder() {
  const container = document.getElementById("item-container");
  [...container.children]
    .sort((a, b) => (+a.dataset.index || 0) - (+b.dataset.index || 0))
    .forEach((child) => container.appendChild(child));
}
