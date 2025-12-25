import { extractNameFromPath, isPhone, readFile, readJsonFile } from "./util.js";

const INTERVALL_MS = 1000; 
const OVERLAY_NODE = document.getElementById('global-average-overlay-items-container');

let first_run = true;

let last_data = null;

//   <div class="item-box-container">
//         <div class="item-box-number">7</div>
//         <div class="item-box"></div>
//     </div>


function findImageRecursive(currentItem, id) {
    // Drill-down until array

    const keys = Object.keys(currentItem);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const nextItem = currentItem[key];
  
      if (nextItem instanceof Array) {
        for (let j = 0; j < nextItem.length; j++) {
          const item = nextItem[j];
          if (item.includes(id)) {
            return item;
          }
        }
      } else if (typeof nextItem === 'object') {
        const result = findImageRecursive(nextItem, id);
        if (result) {
          return result;
        }
      }
    }
  
    return null;
}


async function findImage(id) {

    let urls = await readJsonFile('item-data/indexed_json.json');
    let currentItem = urls;
    return findImageRecursive(currentItem, id);
}


function createItemBox(img, score, name) {
    const item_box_container = document.createElement('div');
    item_box_container.classList.add('average-item-box-container');

    const item_box_number = document.createElement('div');
    item_box_number.classList.add('average-item-box-number');
    item_box_number.innerText = score;
    
    const item_box = document.createElement('div');
    item_box.classList.add('average-item-box');

    const image_element = document.createElement('img');
    image_element.setAttribute('loading', 'lazy');
    image_element.src = img;

    const item_box_name = document.createElement('div');
    item_box_name.classList.add('average-item-box-name');
    item_box_name.innerText = name;


    item_box.appendChild(image_element);
    
    item_box_container.appendChild(item_box_name);
    item_box_container.appendChild(item_box_number);
    item_box_container.appendChild(item_box);

    OVERLAY_NODE.appendChild(item_box_container);
}

function ascendingOrderData(data) {
    const items = Object.keys(data);
    items.sort((a, b) => {
        const avgA = data[a]["global-average"];
        const avgB = data[b]["global-average"];
        return avgA - avgB;
    });

    return items;
}

function compareData(data, oldData) {
    const items = Object.keys(data);

    let changes = [];

    for(let i = 0; i < items.length; i++) {
        const item = items[i];
        const avg1 = data[item]["global-average"];
        const avg2 = oldData[item]["global-average"];

        if(avg1 !== avg2) {
            changes.push({
                id: item,
                old: avg1,
                new: avg2
            });
        }
    }

    return changes;
}


setInterval( async() => {
    const response = await fetch('backend/send-global-average.php');
    let fullData = await response.json();
    let data = fullData.items || {};

    // const changes = compareData(data, last_data || {});
    // if(changes.length == 0) return;

    if(first_run) {

        const images = ascendingOrderData(data);
        const img_length = images.length;

        for (let i = 0; i < img_length; i++) {
            const current_img = images[i];
            const current_data = data[current_img];
            const current_name = extractNameFromPath(current_img);

            const img_path = await findImage(current_img);
            const resolution = isPhone ? "256" : "512"; // Phone 256, Tablet, Desktop 512
            const url = "item-data/" + img_path.replace("**", resolution);

            const average = current_data["global-average"];

            if(average >= 1) {
                createItemBox(url, average, current_name);
            }
        }
    }


    first_run = false;
    last_data = data;

}, INTERVALL_MS);