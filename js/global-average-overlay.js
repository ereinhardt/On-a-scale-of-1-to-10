import {
  extractNameFromPath,
  isPhone,
  readJsonFile,
  animationQueue,
  delay,
} from "./util.js";

const INTERVALL_MS = 10000;
const ANIMATION_DURATION_MS = 250;
const MAX_ANIMATED_ITEMS = 150;
const RESOLUTION = isPhone ? "256" : "512";
const OVERLAY_NODE = document.getElementById(
  "global-average-overlay-items-container",
);

let first_run = true;
let imageHash = [];

// IDs of items currently being added (prevents duplicates)
const pendingItems = new Set();

function resolveItemUrl(id) {
  const img_path = imageHash.find((str) => str.includes(id));
  return "item-data/" + img_path.replace("**", RESOLUTION);
}

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

  // Prevent duplicate items
  if (OVERLAY_NODE.querySelector(`[data-id="${id}"]`)) return null;

  const item_box_container = document.createElement("div");
  item_box_container.classList.add("average-item-box-container");
  item_box_container.dataset.id = id;
  item_box_container.dataset.score = score;

  if (fadeIn) {
    item_box_container.style.opacity = "0";
    item_box_container.style.maxHeight = "0";
    item_box_container.style.overflow = "hidden";
    item_box_container.style.transition = `opacity ${ANIMATION_DURATION_MS / 1000}s ease-in-out, max-height ${ANIMATION_DURATION_MS / 1000}s ease-in-out`;
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
  const insertBefore = Array.from(OVERLAY_NODE.children)
    .find((item) => score < (parseFloat(item.dataset.score) || 0));
  OVERLAY_NODE.insertBefore(item_box_container, insertBefore || null);

  if (fadeIn) {
    const targetHeight = getComputedStyle(document.documentElement).getPropertyValue("--item-size").trim();

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

function isOverlayOpen() {
  const overlay = document.getElementById("global-average-overlay");
  return !!overlay && overlay.classList.contains("open");
}

// Animation
// Sorts DOM elements according to desired order (FLIP approach)
// Computes desired order from current DOM scores at execution time
function sortFieldsByOrder() {
  animationQueue.add(async () => {
    const fields = document.getElementsByClassName("average-item-box-container");
    if (fields.length === 0) return;

    const fieldsArray = Array.from(fields);
    const desiredElements = fieldsArray
      .slice()
      .sort(
        (a, b) =>
          parseFloat(a.dataset.score) - parseFloat(b.dataset.score) ||
          a.dataset.id.localeCompare(b.dataset.id),
      );

    if (desiredElements.every((el, i) => fieldsArray[i] === el)) return;

    const parent = fieldsArray[0].parentElement;
    const shouldAnimate =
      isOverlayOpen() && fieldsArray.length <= MAX_ANIMATED_ITEMS;

    if (!shouldAnimate) {
      desiredElements.forEach((el) => parent.appendChild(el));
      return;
    }

    // Force content-visibility for correct measurements
    fieldsArray.forEach((f) => (f.style.contentVisibility = "visible"));
    fieldsArray[0]?.offsetHeight;

    // FLIP: Record old positions
    const oldPositions = new Map();
    fieldsArray.forEach((f) => {
      oldPositions.set(f.dataset.id, f.getBoundingClientRect().top);
    });

    // Reorder DOM to desired order
    desiredElements.forEach((el) => parent.appendChild(el));

    // FLIP: Calculate deltas and offset items back to old positions
    const movedItems = [];
    desiredElements.forEach((f) => {
      const oldTop = oldPositions.get(f.dataset.id);
      const newTop = f.getBoundingClientRect().top;
      const delta = oldTop - newTop;
      if (Math.abs(delta) > 0.5) {
        f.style.transition = "none";
        f.style.transform = `translateY(${delta}px)`;
        movedItems.push(f);
      }
    });

    if (movedItems.length > 0) {
      // Animate all moved items in parallel to keep large lists responsive
      fieldsArray[0]?.offsetHeight;
      movedItems.forEach((item) => {
        item.style.transition = `transform ${ANIMATION_DURATION_MS}ms ease`;
        item.style.transform = "none";
      });

      await delay(ANIMATION_DURATION_MS);
    }

    // Cleanup
    fieldsArray.forEach((f) => {
      f.style.contentVisibility = "";
      f.style.transition = "";
      f.style.transform = "";
    });
  });
}

let isRunning = false;

// It can happen that there are so many images that loading takes longer than the interval time (maybe FIXED with try-block?)
setInterval(async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const response = await fetch("backend/send-global-average.php", { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) {
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
        const current_name = extractNameFromPath(current_img);
        const url = resolveItemUrl(current_img);
        createItemBox(url, data[current_img]["global-average"], current_name, current_img);
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
      const shouldAnimateAdds =
        isOverlayOpen() && currentIds.length <= MAX_ANIMATED_ITEMS;

      for (const id of desiredOrder) {
        if (
          !currentIds.includes(id) &&
          !pendingItems.has(id) &&
          data[id]["global-average"] >= 1
        ) {
          pendingItems.add(id); // Mark as "being added"

          const current_name = extractNameFromPath(id);
          const url = resolveItemUrl(id);
          const average = data[id]["global-average"];

          if (!shouldAnimateAdds) {
            createItemBox(url, average, current_name, id, false);
            pendingItems.delete(id);
            continue;
          }

          animationQueue.add(async () => {
            createItemBox(url, average, current_name, id, true);
            pendingItems.delete(id);
            await delay(ANIMATION_DURATION_MS);
          });
        }
      }

      sortFieldsByOrder();
    }
  } finally {
    isRunning = false;
  }
}, INTERVALL_MS);
