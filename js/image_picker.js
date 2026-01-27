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
    this.usedSubcategories = new Set();
  }

  // Extracts the subcategory from an item URL
  // e.g. "item-data/History/Countries_Tier_List_Maker__edit/abc.png" -> "History/Countries_Tier_List_Maker__edit"
  getSubcategory(url) {
    const parts = url.replace(/^item-data\//, "").split("/");
    parts.pop(); // Remove filename
    return parts.join("/");
  }

  isSubcategoryUsed(id) {
    const subcategory = this.getSubcategory(id);
    return subcategory && this.usedSubcategories.has(subcategory);
  }

  markAsUsed(id) {
    const subcategory = this.getSubcategory(id);
    if (subcategory) {
      this.usedSubcategories.add(subcategory);
    }
  }

  resetUsedItems() {
    this.usedSubcategories.clear();
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

    // Avoid items from already used subcategories
    while (this.isSubcategoryUsed(random_url)) {
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
      try {
        img = await download_image(url);
        this.cache[url] = img;
      } catch (e) {
        // Image failed to load, skip
        return;
      }
    }

    if (i < 0) {
      this.queue.push(new ImageItem(url, img));
    } else {
      this.queue[i] = new ImageItem(url, img);
    }
  }

  nextImage() {
    // Find first item whose subcategory is not yet used
    const index = this.queue.findIndex(
      (item) => item?.id && !this.isSubcategoryUsed(item.id),
    );

    // Remove selected item (or first as fallback)
    const selectedItem = this.queue.splice(index >= 0 ? index : 0, 1)[0];

    // Add new random item to queue
    this.setImage(this.getRandomUrl(), -1);

    return selectedItem;
  }
}
