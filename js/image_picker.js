import { download_image } from "./util.js";

export class ImageItem {
  constructor(id, image) {
    this.id = id;
    this.image = image;
  }
}

export default class ImagePicker {
  constructor(urls, queue_length) {
    this.urls = urls;
    this.queue_length = queue_length;

    if (this.urls.length < this.queue_length) {
      throw Error("assert: this.urls < this.queue_length");
    }

    this.queue = new Array(this.queue_length).fill(0);
    this.cache = {};
    this.usedInGame = new Set();
  }

  allreadyInserted(id) {
    // Check if item was already used in current game
    if (this.usedInGame.has(id)) return true;

    return false;
  }

  markAsUsed(id) {
    this.usedInGame.add(id);
  }

  // Resets the list of used items (for new game)
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
      this.queue[i] = new ImageItem(url, img);
    }
  }

  nextImage() {
    const random_url = this.getRandomUrl();

    const new_image = this.queue.shift();

    this.setImage(random_url, -1);

    return new_image;
  }
}
