const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_COOLDOWN_MS = 25000;

// Store reload attempts in sessionStorage
function getReloadCount() {
  const data = sessionStorage.getItem("debugReloadData");
  if (!data) return 0;

  const { count, timestamp } = JSON.parse(data);
  // Reset if last attempt was more than 30 seconds ago
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
    }),
  );
  return count;
}

function clearReloadCount() {
  sessionStorage.removeItem("debugReloadData");
}

function isFatalError(error) {
  const errorString = error?.message || error?.toString() || "";

  // Detect fatal errors that make the game unplayable
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
  console.error(`Fatal error detected (${source}):`, error);

  const reloadCount = getReloadCount();

  if (reloadCount >= MAX_RELOAD_ATTEMPTS) {
    console.error(
      `Maximum reload attempts (${MAX_RELOAD_ATTEMPTS}) reached. Please reload manually.`,
    );
    clearReloadCount();
    return;
  }

  const newCount = incrementReloadCount();
  console.log(`Auto-reloading... (Attempt ${newCount}/${MAX_RELOAD_ATTEMPTS})`);

  setTimeout(() => {
    location.reload();
  }, RELOAD_COOLDOWN_MS);
}

// Global error handler
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

// reset reload counter
window.addEventListener("load", () => {
  setTimeout(() => {
    clearReloadCount();
    console.log("Page loaded successfully, reload counter reset.");
  }, 3000);
});

// Automatic reload at midnight (00:00) and noon (12:00)
function scheduleAutoReload() {
  const now = new Date();

  // Find next 00:00 or 12:00
  const targets = [0, 12];
  let nearest = Infinity;

  for (const hour of targets) {
    const t = new Date();
    t.setHours(hour, 0, 0, 0);
    if (t.getTime() <= now.getTime()) {
      t.setDate(t.getDate() + 1);
    }
    const diff = t.getTime() - now.getTime();
    if (diff < nearest) nearest = diff;
  }

  console.log(
    `Auto-reload scheduled in ${Math.round(nearest / 1000 / 60)} minutes`,
  );

  setTimeout(() => {
    console.log("Scheduled reload - reloading page...");
    location.reload();
  }, nearest);
}

scheduleAutoReload();

export { handleFatalError, isFatalError };
