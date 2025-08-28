
// uiManager.js
// Manages UI components such as sliders, dropdowns, and event listeners.

export function setupIntroDismissal() {
  document.getElementById("startButton").addEventListener("click", () => {
    document.getElementById("intro").style.transform = "translateY(-100%)";
    setTimeout(() => {
      document.getElementById("intro").style.display = "none";
    }, 1000);
  });
}
