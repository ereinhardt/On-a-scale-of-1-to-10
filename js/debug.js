// Debug-Modul für automatisches Neuladen bei fatalen Fehlern in scene.js oder la.js (komplett unabhängig)
const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_COOLDOWN_MS = 25000;

// Speichere Reload-Versuche im sessionStorage
function getReloadCount() {
  const data = sessionStorage.getItem("debugReloadData");
  if (!data) return 0;

  const { count, timestamp } = JSON.parse(data);
  // Reset wenn letzter Versuch länger als 30 Sekunden her
  if (Date.now() - timestamp > 30000) return 0;
  return count;
}

function incrementReloadCount() {
  const count = getReloadCount() + 1;
  sessionStorage.setItem(
    "debugReloadData",
    JSON.stringify({
      count,
      timestamp: Date.now(),
    })
  );
  return count;
}

function clearReloadCount() {
  sessionStorage.removeItem("debugReloadData");
}

function isFatalError(error) {
  const errorString = error?.message || error?.toString() || "";

  // Erkenne fatale Fehler die das Spiel unspielbar machen
  const fatalPatterns = [
    /filter/i,
    /OneEuroFilter/i,
    /scene/i,
    /detector/i,
    /faceLandmarksDetection/i,
    /MediaPipeFaceMesh/i,
    /Cannot read properties of undefined/i,
    /Cannot read properties of null/i,
    /is not a function/i,
    /WebGL/i,
    /THREE/i,
  ];

  return fatalPatterns.some((pattern) => pattern.test(errorString));
}

function handleFatalError(error, source = "unknown") {
  console.error(`[Debug] Fataler Fehler erkannt (${source}):`, error);

  const reloadCount = getReloadCount();

  if (reloadCount >= MAX_RELOAD_ATTEMPTS) {
    console.error(
      `[Debug] Maximale Reload-Versuche (${MAX_RELOAD_ATTEMPTS}) erreicht. Bitte manuell neuladen.`
    );
    clearReloadCount();
    return;
  }

  const newCount = incrementReloadCount();
  console.log(
    `[Debug] Automatisches Neuladen... (Versuch ${newCount}/${MAX_RELOAD_ATTEMPTS})`
  );

  setTimeout(() => {
    location.reload();
  }, RELOAD_COOLDOWN_MS);
}

// Globaler Error Handler
window.addEventListener("error", (event) => {
  if (isFatalError(event.error)) {
    handleFatalError(event.error, "window.onerror");
  }
});

// Promise Rejection Handler
window.addEventListener("unhandledrejection", (event) => {
  if (isFatalError(event.reason)) {
    handleFatalError(event.reason, "unhandledrejection");
  }
});

// Wenn Seite erfolgreich geladen wird, Reset der Reload-Zähler
window.addEventListener("load", () => {
  // Warte kurz um sicherzustellen, dass alles initialisiert ist
  setTimeout(() => {
    clearReloadCount();
    console.log(
      "[Debug] Seite erfolgreich geladen, Reload-Zähler zurückgesetzt."
    );
  }, 3000);
});

export { handleFatalError, isFatalError };
