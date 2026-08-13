try {
  const savedTheme = JSON.parse(localStorage.getItem("novel-phoenix-theme-v1"));
  document.documentElement.dataset.mode = savedTheme?.mode === "dark" ? "dark" : "light";
} catch (_) {
  document.documentElement.dataset.mode = "light";
}
