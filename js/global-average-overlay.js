import {
  extractNameFromPath,
  isPhone,
  readJsonFile,
  repositionField,
  animationQueue,
  delay,
} from "./util.js";

const INTERVALL_MS = 1000;
const OVERLAY_NODE = document.getElementById(
  "global-average-overlay-items-container"
);

let first_run = true;
let imageHash = {};

// IDs von Items die gerade hinzugefügt werden (verhindert Duplikate)
const pendingItems = new Set();

async function findImage(id) {
  return imageHash.find((str) => str.includes(id));
}

function buildImageIndex(data) {
  const index = {}; // Oder new Map()

  function traverse(item) {
    if (!item || typeof item !== "object") return;

    if (Array.isArray(item)) {
      item.forEach((str) => {
        if (typeof str === "string") {
          // Wir speichern den String als Key für schnellen Zugriff
          // Hier musst du entscheiden: Suchst du nach exakter ID oder Teilstring?
          // Für 'includes'-Suche ist ein flaches Array besser.
          index[str] = true;
        }
      });
    } else {
      for (const key in item) {
        traverse(item[key]);
      }
    }
  }

  traverse(data);
  return Object.keys(index); // Gibt eine flache Liste aller Bilder zurück
}

function createItemBox(img, score, name, id, fadeIn = false) {
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
    void item_box_container.offsetWidth; // Reflow
    item_box_container.style.opacity = "1";
    item_box_container.style.maxHeight = "500px";

    // Nach Animation die Styles zurücksetzen
    setTimeout(() => {
      item_box_container.style.maxHeight = "";
      item_box_container.style.overflow = "";
      item_box_container.style.transition = "";
    }, 300);
  }

  return item_box_container;
}

function ascendingOrderData(data) {
  const items = Object.keys(data);
  items.sort((a, b) => {
    const avgA = data[a]["global-average"];
    const avgB = data[b]["global-average"];
    return avgA - avgB; // Aufsteigend: 1 bis 10
  });

  return items;
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
          await delay(300);
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
        await delay(300);
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
    imageHash = buildImageIndex(
      await readJsonFile("item-data/indexed_json.json")
    );

    // console.log("Initial load of global average overlay.");
    const images = ascendingOrderData(data);
    const img_length = images.length;

    for (let i = 0; i < img_length; i++) {
      const current_img = images[i];
      const current_data = data[current_img];
      const average = current_data["global-average"];

      if (average < 1) continue;

      const current_name = extractNameFromPath(current_img);

      const img_path = await findImage(current_img);
      const resolution = isPhone ? "256" : "512"; // Phone 256, Tablet, Desktop 512
      const url = "item-data/" + img_path.replace("**", resolution);

      // console.log(current_data);

      if (average >= 1) {
       // console.log("Adding item to overlay:", current_name, average);
        createItemBox(url, average, current_name, current_img);
      }

      isRunning = false;
    }
  } else if (!isRunning) {
    isRunning = true;
    // Scores aktualisieren
    const fields = document.getElementsByClassName(
      "average-item-box-container"
    );
    for (const field of fields) {
      const id = field.dataset.id;
      if (data[id]) {
        const newScore = data[id]["global-average"];
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
        findImage(id).then((img_path) => {
          const resolution = isPhone ? "256" : "512";
          const url = "item-data/" + img_path.replace("**", resolution);
          const average = data[id]["global-average"];

          animationQueue.add(async () => {
            // Nochmals prüfen ob Item bereits im DOM existiert (Race-Condition verhindern)
            const existingItem = document.querySelector(
              `.average-item-box-container[data-id="${id}"]`
            );
            if (!existingItem) {
              createItemBox(url, average, current_name, id, true);
            }
            pendingItems.delete(id);
            await delay(300);
          });
        });
      }
    }

    // Sortieren
    sortFieldsByOrder(desiredOrder);
    isRunning = false;
  }
}, INTERVALL_MS);
