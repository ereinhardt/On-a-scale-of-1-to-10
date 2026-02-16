import {
  extractNameFromPath,
  isPhone,
  readJsonFile,
  repositionField,
  animationQueue,
  delay,
} from "./util.js";

const INTERVALL_MS = 5000;
const ANIMATION_DURATION_MS = 250;
const ANIMATION_DURATION_S = ANIMATION_DURATION_MS / 1000;
const RESOLUTION = isPhone ? "256" : "512";
const OVERLAY_NODE = document.getElementById(
  "global-average-overlay-items-container",
);

let first_run = true;
let imageHash = [];

// IDs of items currently being added (prevents duplicates)
const pendingItems = new Set();

// Flattens nested objects/arrays into a list of strings
function flattenImages(data) {
  if (typeof data === "string") return [data];
  if (Array.isArray(data)) return data.flatMap(flattenImages);
  if (typeof data === "object" && data)
    return Object.values(data).flatMap(flattenImages);
  return [];
}

function createItemBox(img, score, name, id, fadeIn = false) {
  // Prevent items with score < 1
  if (score < 1) return null;

  const item_box_container = document.createElement("div");
  item_box_container.classList.add("average-item-box-container");
  item_box_container.dataset.id = id;
  item_box_container.dataset.score = score;

  if (fadeIn) {
    item_box_container.style.opacity = "0";
    item_box_container.style.maxHeight = "0";
    item_box_container.style.overflow = "hidden";
    item_box_container.style.transition = `opacity ${ANIMATION_DURATION_S}s ease-in-out, max-height ${ANIMATION_DURATION_S}s ease-in-out`;
  }

  const item_box_number = document.createElement("div");
  item_box_number.classList.add("average-item-box-number");
  item_box_number.innerText = score;

  const item_box = document.createElement("div");
  item_box.classList.add("average-item-box");

  const image_element = document.createElement("img");
  image_element.setAttribute("loading", "lazy");
  image_element.src = img;

  // Retry logic for failed images (retries: 2s, 4s, 8s, 16s, 32s = ~1min total)
  image_element.addEventListener("error", function retry() {
    const retries = parseInt(this.dataset.retries || "0");
    if (retries < 5) {
      this.dataset.retries = retries + 1;
      setTimeout(
        () => {
          this.src = img;
        },
        2000 * Math.pow(2, retries),
      );
    }
  });

  const item_box_name = document.createElement("div");
  item_box_name.classList.add("average-item-box-name");
  item_box_name.innerText =
    name.length > 40 ? name.substring(0, 40) + "..." : name;

  item_box.appendChild(image_element);

  item_box_container.appendChild(item_box_name);
  item_box_container.appendChild(item_box_number);
  item_box_container.appendChild(item_box);

  // Insert at correct position (ascending by score)
  const existingItems = Array.from(OVERLAY_NODE.children);
  let insertBefore = null;
  for (const item of existingItems) {
    const itemScore = parseFloat(item.dataset.score) || 0;
    if (score < itemScore) {
      insertBefore = item;
      break;
    }
  }

  if (insertBefore) {
    OVERLAY_NODE.insertBefore(item_box_container, insertBefore);
  } else {
    OVERLAY_NODE.appendChild(item_box_container);
  }

  if (fadeIn) {
    const targetHeight = item_box_container.scrollHeight + "px";

    requestAnimationFrame(() => {
      item_box_container.style.opacity = "1";
      item_box_container.style.maxHeight = targetHeight;
    });

    setTimeout(() => {
      item_box_container.style.maxHeight = "";
      item_box_container.style.overflow = "";
      item_box_container.style.transition = "";
    }, ANIMATION_DURATION_MS);
  }

  return item_box_container;
}

function ascendingOrderData(data) {
  return Object.keys(data)
    .filter((key) => data[key]["global-average"] >= 1)
    .sort((a, b) => data[a]["global-average"] - data[b]["global-average"]);
}

// Animation
// Sorts DOM elements according to desired order
function sortFieldsByOrder(desiredOrder) {
  const fields = document.getElementsByClassName("average-item-box-container");
  if (fields.length === 0) return;

  const currentOrder = Array.from(fields).map((f) => f.dataset.id);

  const existingDesiredOrder = desiredOrder.filter((id) =>
    currentOrder.includes(id),
  );

  // Find all items that need to move
  const itemsToMove = [];
  for (let i = 0; i < existingDesiredOrder.length; i++) {
    const desiredId = existingDesiredOrder[i];
    const currentIndex = currentOrder.indexOf(desiredId);

    if (currentIndex !== i && currentIndex !== -1) {
      itemsToMove.push({ desiredId, targetIndex: i });
    }
  }

  // Add one queue entry per item (not per step)
  for (const { desiredId, targetIndex } of itemsToMove) {
    animationQueue.add(async () => {
      const freshFields = document.getElementsByClassName(
        "average-item-box-container",
      );
      if (freshFields.length === 0 || targetIndex >= freshFields.length) {
        await delay(ANIMATION_DURATION_MS);
        return;
      }

      const freshOrder = Array.from(freshFields).map((f) => f.dataset.id);
      const freshFromIndex = freshOrder.indexOf(desiredId);

      if (
        freshFromIndex !== -1 &&
        freshFromIndex !== targetIndex &&
        targetIndex < freshFields.length
      ) {
        repositionField(freshFields, targetIndex, freshFromIndex);
      }
      await delay(ANIMATION_DURATION_MS);
    });
  }
}

let isRunning = false;

// It can happen that there are so many images that loading takes longer than the interval time (maybe FIXED with try-block?)
setInterval(async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const response = await fetch("backend/send-global-average.php").catch(() => null);
    if (!response || !response.ok) {
      isRunning = false;
      return;
    }
    let fullData = await response.json();
    let data = fullData.items || {};

    if (first_run) {
      first_run = false;
      imageHash = flattenImages(
        await readJsonFile("item-data/indexed_json.json"),
      );

      const images = ascendingOrderData(data);

      for (const current_img of images) {
        const average = data[current_img]["global-average"];
        if (average < 1) continue;

        const current_name = extractNameFromPath(current_img);
        const img_path = imageHash.find((str) => str.includes(current_img));
        const url = "item-data/" + img_path.replace("**", RESOLUTION);

        createItemBox(url, average, current_name, current_img);
      }
    } else {
      // Update scores
      const fields = document.getElementsByClassName(
        "average-item-box-container",
      );
      for (let i = fields.length - 1; i >= 0; i--) {
        const field = fields[i];
        const id = field.dataset.id;
        if (data[id]) {
          const newScore = data[id]["global-average"];
          // Remove items with score < 1
          if (newScore < 1) {
            field.remove();
            continue;
          }
          const oldScore = parseFloat(field.dataset.score);
          if (newScore !== oldScore) {
            field.dataset.score = newScore;
            const numberEl = field.querySelector(".average-item-box-number");
            if (numberEl) numberEl.innerText = newScore;
          }
        }
      }

      // Detect and add new items
      const currentIds = Array.from(
        document.getElementsByClassName("average-item-box-container"),
      ).map((f) => f.dataset.id);
      const desiredOrder = ascendingOrderData(data);

      for (const id of desiredOrder) {
        if (
          !currentIds.includes(id) &&
          !pendingItems.has(id) &&
          data[id]["global-average"] >= 1
        ) {
          pendingItems.add(id); // Mark as "being added"

          const current_name = extractNameFromPath(id);
          const img_path = imageHash.find((str) => str.includes(id));
          const url = "item-data/" + img_path.replace("**", RESOLUTION);
          const average = data[id]["global-average"];

          animationQueue.add(async () => {
            createItemBox(url, average, current_name, id, true);
            pendingItems.delete(id);
            await delay(ANIMATION_DURATION_MS);
          });
        }
      }

      sortFieldsByOrder(desiredOrder);
    }
  } finally {
    isRunning = false;
  }
}, INTERVALL_MS);
