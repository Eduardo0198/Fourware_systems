const userInput = document.querySelector('#usuario');
const passInput = document.querySelector('#password');
const loginBtn = document.querySelector('#loginBtn');
const msg = document.querySelector('#msg');

loginBtn.addEventListener('click', () => {
  const hasUser = userInput.value.trim() !== '';
  const hasPass = passInput.value.trim() !== '';

  if (!hasUser || !hasPass) {
    msg.textContent = 'Completa usuario y contraseña';
    msg.style.color = '#b00020';
    return;
  }

  msg.textContent = 'Inicio de sesión enviado';
  msg.style.color = '#0f7a26';
});
