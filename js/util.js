export async function readFile(path) {
  const res = await fetch(path);

  if (!res.ok) throw Error("Could not found file at " + path);

  return await res.text();
}

export async function readJsonFile(path) {
  const res = await fetch(path);

  if (!res.ok) throw Error("Could not found file at " + path);

  return await res.json();
}

export async function download_image(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = path;
    //img.crossOrigin = "anonymous";

    img.onload = () => {
      resolve(img);
    };

    img.onerror = (err) => {
      reject(err);
    };
  });
}

export function extractNameFromPath(path) {
    if (!path) return "";
    const parts = path.split("__");
    const filename = parts[parts.length - 1];
    const name = filename.substring(0, filename.lastIndexOf("."));
    return name.replace(/_/g, " ");
  }

export const isPhone = Math.min(window.screen.width, window.screen.height) < 768;

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// Animation
// ============================================

export function repositionField(fields, targetIndex, startIndex) {
  if (!fields || fields.length === 0) return;
  if (targetIndex === startIndex) return;

  const fieldsArray = Array.from(fields);
  const field = fieldsArray[startIndex];
  const target = fieldsArray[targetIndex];
  const parent = field.parentElement;

  const fieldRect = field.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const height = fieldRect.height;

  const deltaY = targetRect.top - fieldRect.top;
  field.style.transform = `translateY(${deltaY}px)`;

  // Nach unten schieben: startIndex < targetIndex
  if (startIndex < targetIndex) {
    for (let i = startIndex + 1; i <= targetIndex; i++) {
      fieldsArray[i].style.transform = `translateY(-${height}px)`;
    }
  } 
  // Nach oben schieben: startIndex > targetIndex
  else {
    for (let i = targetIndex; i < startIndex; i++) {
      fieldsArray[i].style.transform = `translateY(${height}px)`;
    }
  }

  setTimeout(() => {
    fieldsArray.forEach(f => f.style.transition = 'none');

    parent.removeChild(field);
    if (startIndex < targetIndex) {
      parent.insertBefore(field, target.nextSibling);
    } else {
      parent.insertBefore(field, target);
    }

    fieldsArray.forEach(f => f.style.transform = 'none');
    void field.offsetWidth;
    fieldsArray.forEach(f => f.style.transition = 'transform 0.25s ease-in-out');
  }, 250); 
}

// Animation Queue - Führt Animationen nacheinander aus
class AnimationQueue {
  constructor() {
    this.queue = [];
    this.isRunning = false;
  }

  add(animationFn) {
    this.queue.push(animationFn);
    if (!this.isRunning) this._processNext();
  }

  async _processNext() {
    if (this.queue.length === 0) {
      this.isRunning = false;
      return;
    }
    this.isRunning = true;
    try {
      await this.queue.shift()();
    } catch (e) {
      console.error("Animation error:", e);
    }
    this._processNext();
  }
}

export const animationQueue = new AnimationQueue();