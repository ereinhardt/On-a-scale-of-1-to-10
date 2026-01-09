(function () {
  // Store userId in sessionStorage
  let userId = sessionStorage.getItem("userId");
  if (!userId) {
    userId = "user_" + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem("userId", userId);
  }
  const userCountApi = "./backend/user-count.php";
  const statsApi = "./backend/send-global-average.php";

  // Always ping to register user
  function pingUser() {
    fetch(userCountApi + "?action=ping&userId=" + userId).catch(() => {});
  }

  const showStats = localStorage.getItem("showStats") === "true";
  const statsContainer = document.querySelector(".stats-container");

  // Only use pingUser if stats are hidden
  if (!showStats) {
    pingUser();
    setInterval(pingUser, 1000);
    if (statsContainer) statsContainer.style.display = "none";
  }

  window.addEventListener("beforeunload", function () {
    navigator.sendBeacon(userCountApi + "?action=leave&userId=" + userId);
  });

  if (!showStats) {
    return;
  }

  function updateUserCount() {
    fetch(userCountApi + "?action=ping&userId=" + userId)
      .then((response) => response.json())
      .then((data) => {
        const el = document.getElementById("user-count");
        if (el) el.textContent = "Current users: " + data.count;
      })
      .catch(() => {});
  }

  function updateItemStats() {
    fetch(statsApi)
      .then((response) => response.json())
      .then((data) => {
        if (data["total-stats"]) {
          const stats = data["total-stats"];
          const totalEl = document.getElementById("total-item-number");
          const ratedEl = document.getElementById("total-rated-item-number");
          const sumEl = document.getElementById("total-sum-number");
          if (totalEl)
            totalEl.textContent = "Total items: " + stats["total-item-number"];
          if (ratedEl)
            ratedEl.textContent =
              "Rated items: " + stats["total-rated-item-number"];
          if (sumEl)
            sumEl.textContent = "Total ratings: " + stats["total-sum-number"];
        }
      })
      .catch(() => {});
  }

  updateUserCount();
  updateItemStats();
  setInterval(updateUserCount, 1000);
  setInterval(updateItemStats, 10000);
})();
