import { download_image } from "./util.js";

export class ImageItem {
  constructor(id, image) {
    this.id = id;
    this.image = image;
  }
}

export default class ImagePicker {
  constructor(urls, queue_length, allready_inserted_cap) {
    this.urls = urls;
    this.queue_length = queue_length;

    if (this.urls.length < this.queue_length) {
      throw Error("assert: this.urls < this.queue_length");
    }

    this.queue = new Array(this.queue_length).fill(0);
    this.allreadyInsertedCap = allready_inserted_cap;
    this.cache = {};
    this.usedInGame = new Set(); // Speichert alle im aktuellen Spiel verwendeten Items
  }

  allreadyInserted(id) {
    // Prüfe ob Item bereits im aktuellen Spiel verwendet wurde
    if (this.usedInGame.has(id)) return true;

    for (let i = 0; i < this.queue.length; i++) {
      let currentItem = this.queue[i];
      if (currentItem instanceof ImageItem && currentItem.id === id) {
        return true;
      }
    }

    return false;
  }

  // Markiert ein Item als im Spiel verwendet
  markAsUsed(id) {
    this.usedInGame.add(id);
  }

  // Setzt die Liste der verwendeten Items zurück (für neues Spiel)
  resetUsedItems() {
    this.usedInGame.clear();
  }

  getRandomItem() {
    let currentItem = this.urls;

    // Drill-down until array
    while (!(currentItem instanceof Array)) {
      const keys = Object.keys(currentItem);
      const random_key_index = Math.floor(Math.random() * keys.length);
      const random_key = keys[random_key_index];
      currentItem = currentItem[random_key];
    }

    const random_index = Math.floor(Math.random() * currentItem.length);

    // Use screen dimensions to avoid triggering on resized desktop windows
    const isPhone = Math.min(window.screen.width, window.screen.height) < 768;
    const resolution = isPhone ? "256" : "512"; // Phone 256, Tablet, Desktop 512

    const url =
      "item-data/" + currentItem[random_index].replace("**", resolution);

    return url;
  }

  getRandomUrl() {
    let random_url = this.getRandomItem();

    while (this.allreadyInserted(random_url)) {
      random_url = this.getRandomItem();
    }

    return random_url;
  }

  async init() {
    for (let i = 0; i < this.queue.length; i++) {
      const random_url = this.getRandomUrl();
      await this.setImage(random_url, i);
    }
  }

  async setImage(url, i) {
    let img;

    const cached_urls = Object.keys(this.cache);

    if (cached_urls.includes(url)) {
      img = this.cache[url];
    } else {
      img = await download_image(url);
      this.cache[url] = img;
    }

    if (i < 0) {
      this.queue.push(new ImageItem(url, img));
    } else {
      this.queue[i] = new ImageItem(url, img); // ✔ korrekt
    }
  }

  nextImage() {
    const random_url = this.getRandomUrl();

    const new_image = this.queue.shift();

    // Markiere das Item als im Spiel verwendet
    if (new_image instanceof ImageItem) {
      this.markAsUsed(new_image.id);
    }

    this.setImage(random_url, -1);

    return new_image;
  }
}
