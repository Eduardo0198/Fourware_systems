const form = document.querySelector("#loginForm");
const userInput = document.querySelector("#usuario");
const passInput = document.querySelector("#password");
const msg = document.querySelector("#msg");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const hasUser = userInput.value.trim() !== "";
  const hasPass = passInput.value.trim() !== "";

  if (!hasUser || !hasPass) {
    msg.textContent = "Completa usuario y contraseña";
    msg.style.color = "#b00020";
    return;
  }

  msg.textContent = "Inicio de sesión correcto. Redirigiendo...";
  msg.style.color = "#0f7a26";

  setTimeout(() => {
    window.location.href = "./marketing.html";
  }, 600);
});
