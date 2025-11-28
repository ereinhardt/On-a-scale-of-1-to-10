
export async function readFile(path) {

    const res = await fetch(path);

    if(!res.ok) throw Error("Could not found file at " + path);

    return await res.text()

}
export async function download_image(path) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = path;
        img.crossOrigin = "anonymous";

        img.onload = () => {
            resolve(img);
        };

        img.onerror = (err) => {
            reject(err);
        };
    });
}