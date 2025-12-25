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