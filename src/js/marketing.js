const sidebarLinks = document.querySelectorAll(".menu-link");
const modules = document.querySelectorAll(".module");
const downloadButtons = document.querySelectorAll(".report-btn");

const routes = {
  dashboard: "dashboard",
  ranking: "ranking",
  tendencias: "tendencias",
  prototipos: "prototipos",
  comparativos: "comparativos",
  reportes: "reportes",
};

function setActiveModule(moduleId) {
  const safeId = routes[moduleId] ? moduleId : "dashboard";

  modules.forEach((module) => {
    module.classList.toggle("active", module.id === safeId);
  });

  sidebarLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.module === safeId);
  });
}

function navigateTo(moduleId) {
  const safeId = routes[moduleId] ? moduleId : "dashboard";
  window.location.hash = safeId;
  setActiveModule(safeId);
}

sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navigateTo(link.dataset.module);
  });
});

window.addEventListener("hashchange", () => {
  const moduleFromHash = window.location.hash.replace("#", "");
  setActiveModule(moduleFromHash);
});

downloadButtons.forEach((button) => {
  button.addEventListener("click", () => {
    button.textContent = "Descargado";
    button.disabled = true;
  });
});

const firstModule = window.location.hash.replace("#", "") || "dashboard";
setActiveModule(firstModule);
