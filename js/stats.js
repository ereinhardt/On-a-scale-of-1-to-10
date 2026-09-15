(function () {
  // Store userId in sessionStorage
  let userId = sessionStorage.getItem("userId");
  if (!userId) {
    userId = "user_" + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem("userId", userId);
  }
  const userCountApi = "./backend/user-count.php";

  // Always ping to register user
  function pingUser() {
    fetch(userCountApi + "?action=ping&userId=" + userId).catch(() => {});
  }

  pingUser();
  setInterval(pingUser, 1000);

  window.addEventListener("beforeunload", function () {
    navigator.sendBeacon(userCountApi + "?action=leave&userId=" + userId);
  });
})();
