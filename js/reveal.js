import { delay, repositionField } from "./util.js";

const ANIMATION_DURATION = 250; // ms for repositioning
const SCORE_REVEAL_DELAY = 250; // ms between score displays
const PAUSE_BEFORE_SORT = 250; // ms pause before sorting begins

// Fetches global averages
async function fetchGlobalAverages() {
  try {
    const response = await fetch("backend/send-global-average.php");
    if (!response.ok) return null;
    const data = await response.json();
    return data.items || {};
  } catch (e) {
    console.error("Error fetching global averages:", e);
    return null;
  }
}

function getFilename(path) {
  return (
    path
      ?.replace(/__(1024|512|256)__/, "__**__")
      .split("/")
      .pop() || ""
  );
}

// Performs the reveal animation:
export async function revealAnimation(board) {
  const globalAverages = await fetchGlobalAverages();
  if (!globalAverages) {
    console.warn("No global averages available, skipping reveal animation");
    return;
  }

  const container = document.getElementById("item-container");

  // Display scores one after another (positions 1-10)
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

  // Perform sorting with selection sort algorithm
  for (let targetPos = 0; targetPos < 10; targetPos++) {
    let minScore = Infinity;
    let minPos = -1;

    const children = Array.from(container.children);
    for (let i = targetPos; i < children.length; i++) {
      const src = children[i]
        .querySelector(".item-box img")
        ?.getAttribute("src");
      const filename = getFilename(src);
      const scoreData = globalAverages[filename]?.["global-average"];

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

// Resets number display to original values (1-10)
export function resetNumberDisplays() {
  document.querySelectorAll(".item-box-number").forEach((el, i) => {
    el.innerText = i + 1;
  });
}

export function resetContainerOrder() {
  const container = document.getElementById("item-container");
  [...container.children]
    .sort((a, b) => (+a.dataset.index || 0) - (+b.dataset.index || 0))
    .forEach((child) => container.appendChild(child));
}
