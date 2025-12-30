import {
  extractNameFromPath,
  isPhone,
  readJsonFile,
  repositionField,
  animationQueue,
  delay,
} from "./util.js";

const INTERVALL_MS = 1000;
const RESOLUTION = isPhone ? "256" : "512";
const OVERLAY_NODE = document.getElementById(
  "global-average-overlay-items-container"
);

let first_run = true;
let imageHash = [];

// IDs von Items die gerade hinzugefügt werden (verhindert Duplikate)
const pendingItems = new Set();

// Flacht verschachtelte Objekte/Arrays zu einer Liste von Strings ab
function flattenImages(data) {
  if (typeof data === "string") return [data];
  if (Array.isArray(data)) return data.flatMap(flattenImages);
  if (typeof data === "object" && data)
    return Object.values(data).flatMap(flattenImages);
  return [];
}

function createItemBox(img, score, name, id, fadeIn = false) {
  // Verhindere Items mit Score < 1
  if (score < 1) return null;

  const item_box_container = document.createElement("div");
  item_box_container.classList.add("average-item-box-container");
  item_box_container.dataset.id = id;
  item_box_container.dataset.score = score;

  if (fadeIn) {
    item_box_container.style.opacity = "0";
    item_box_container.style.maxHeight = "0";
    item_box_container.style.overflow = "hidden";
    item_box_container.style.transition =
      "opacity 0.25s ease-in-out, max-height 0.25s ease-in-out";
  }

  const item_box_number = document.createElement("div");
  item_box_number.classList.add("average-item-box-number");
  item_box_number.innerText = score;

  const item_box = document.createElement("div");
  item_box.classList.add("average-item-box");

  const image_element = document.createElement("img");
  image_element.setAttribute("loading", "lazy");
  image_element.src = img;

  const item_box_name = document.createElement("div");
  item_box_name.classList.add("average-item-box-name");
  item_box_name.innerText = name;

  item_box.appendChild(image_element);

  item_box_container.appendChild(item_box_name);
  item_box_container.appendChild(item_box_number);
  item_box_container.appendChild(item_box);

  // An der richtigen Stelle einfügen (aufsteigend nach Score)
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
    // Berechne die tatsächliche Höhe für eine flüssige Animation
    const targetHeight = item_box_container.scrollHeight + "px";

    requestAnimationFrame(() => {
      item_box_container.style.opacity = "1";
      item_box_container.style.maxHeight = targetHeight;
    });

    // Nach Animation die Styles zurücksetzen
    setTimeout(() => {
      item_box_container.style.maxHeight = "";
      item_box_container.style.overflow = "";
      item_box_container.style.transition = "";
    }, 250);
  }

  return item_box_container;
}

function ascendingOrderData(data) {
  return Object.keys(data)
    .filter((key) => data[key]["global-average"] >= 1)
    .sort((a, b) => data[a]["global-average"] - data[b]["global-average"]);
}

// ============================================
// Animation
// ============================================

// Sortiert die DOM-Elemente entsprechend der gewünschten Reihenfolge
// Fügt nur EINE Animation hinzu (die erste Diskrepanz)
function sortFieldsByOrder(desiredOrder) {
  const fields = document.getElementsByClassName("average-item-box-container");
  if (fields.length === 0) return;

  // Aktuelle DOM-Reihenfolge ermitteln (über data-id Attribut)
  const currentOrder = Array.from(fields).map((f) => f.dataset.id);

  // Nur Items sortieren die auch im DOM existieren
  const existingDesiredOrder = desiredOrder.filter((id) =>
    currentOrder.includes(id)
  );

  // Finde erste Diskrepanz
  for (let i = 0; i < existingDesiredOrder.length; i++) {
    const desiredId = existingDesiredOrder[i];
    const currentIndex = currentOrder.indexOf(desiredId);

    if (currentIndex !== i && currentIndex !== -1) {
      animationQueue.add(async () => {
        const freshFields = document.getElementsByClassName(
          "average-item-box-container"
        );
        if (freshFields.length === 0 || i >= freshFields.length) {
          await delay(250);
          return;
        }

        const freshOrder = Array.from(freshFields).map((f) => f.dataset.id);
        const freshFromIndex = freshOrder.indexOf(desiredId);

        if (
          freshFromIndex !== -1 &&
          freshFromIndex !== i &&
          i < freshFields.length
        ) {
          repositionField(freshFields, i, freshFromIndex);
        }
        await delay(250);
      });
      return;
    }
  }
}

let isRunning = false;

//es kann pasieren das es so viele images gibt, dass es längert lädt als die intervallzeit
setInterval(async () => {
  const response = await fetch("backend/send-global-average.php");
  // console.log("Fetching global average data...");
  if (!response.ok) return;
  let fullData = await response.json();
  let data = fullData.items || {};

  if (first_run) {
    first_run = false;
    isRunning = true;
    imageHash = flattenImages(
      await readJsonFile("item-data/indexed_json.json")
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
    isRunning = false;
  } else if (!isRunning) {
    isRunning = true;
    // Scores aktualisieren
    const fields = document.getElementsByClassName(
      "average-item-box-container"
    );
    // Rückwärts iterieren um beim Entfernen keine Elemente zu überspringen
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      const id = field.dataset.id;
      if (data[id]) {
        const newScore = data[id]["global-average"];
        // Entferne Items mit Score < 1
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

    // Neue Items erkennen und hinzufügen
    const currentIds = Array.from(
      document.getElementsByClassName("average-item-box-container")
    ).map((f) => f.dataset.id);
    const desiredOrder = ascendingOrderData(data);

    for (const id of desiredOrder) {
      // Prüfen ob Item existiert ODER gerade hinzugefügt wird
      if (
        !currentIds.includes(id) &&
        !pendingItems.has(id) &&
        data[id]["global-average"] >= 1
      ) {
        pendingItems.add(id); // Markieren als "wird hinzugefügt"

        const current_name = extractNameFromPath(id);
        const img_path = imageHash.find((str) => str.includes(id));
        const url = "item-data/" + img_path.replace("**", RESOLUTION);
        const average = data[id]["global-average"];

        animationQueue.add(async () => {
          createItemBox(url, average, current_name, id, true);
          pendingItems.delete(id);
          await delay(250);
        });
      }
    }

    // Sortieren
    sortFieldsByOrder(desiredOrder);
    isRunning = false;
  }
}, INTERVALL_MS);
