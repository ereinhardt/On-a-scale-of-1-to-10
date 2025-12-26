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


export function repositionField(fields, targetIndex, startIndex) {
  if (!fields || fields.length === 0) return;
  if (targetIndex === startIndex) return;

  const fieldsArray = Array.from(fields);
  const field = fieldsArray[startIndex]; // Das Element, das wir bewegen (Index 0)
  const target = fieldsArray[targetIndex]; // Wo es hin soll

  const parent = field.parentElement;

  // 1. Positionen messen
  const fieldRect = field.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const height = fieldRect.height;
  
  // Distanz berechnen (wie viel muss das erste Element runter?)
  // Hinweis: Wenn wir Element 0 unter Element 3 schieben, muss es um (3 * Höhe) runter.
  // Einfacher ist oft: (targetIndex - startIndex) * height + Gap
  const deltaY = targetRect.top - fieldRect.top;

  // 2. Transformationen anwenden (Die Animation startet jetzt)
  
  // Das bewegte Feld nach unten schieben
  field.style.transform = `translateY(${deltaY}px)`;

  // Die Elemente DAZWISCHEN müssen nach OBEN rutschen, um die Lücke zu füllen
  for (let i = startIndex + 1; i <= targetIndex; i++) {
    const intermediateField = fieldsArray[i];
    // Die rutschen genau eine Höhe nach oben
    intermediateField.style.transform = `translateY(-${height}px)`;
  }

  // 3. Warten bis Animation fertig ist, DANN DOM ändern
  // (500ms entspricht der transition im CSS)
  setTimeout(() => {
    // A. Transition kurz ausschalten, damit der Reset nicht animiert wird (kein "Zurückfliegen")
    fieldsArray.forEach(f => f.style.transition = 'none');

    // B. DOM tatsächlich ändern
    parent.removeChild(field);
    // Einfügen NACH dem Target (da wir nach unten schieben)
    parent.insertBefore(field, target.nextSibling);

    // C. Alle Transforms entfernen (Reset)
    // Jetzt sitzen alle Elemente physikalisch an der richtigen Stelle.
    // Wir brauchen keine künstliche Verschiebung mehr.
    fieldsArray.forEach(f => f.style.transform = 'none');

    // D. Browser zwingen, den Style-Change zu registrieren (Reflow)
    void field.offsetWidth;

    // E. Transition wieder einschalten für das nächste Mal
    fieldsArray.forEach(f => f.style.transition = 'transform 0.25s ease-in-out');

  }, 250); 
}