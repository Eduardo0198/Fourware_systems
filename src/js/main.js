const logoutBtn = document.querySelector('#logoutBtn');

logoutBtn.addEventListener('click', () => {
  // Placeholder de accion; aqui conectas tu logout real
  window.alert('Sesion cerrada');
});

const items = document.querySelectorAll('.menu-item');

items.forEach((btn) => {
  btn.addEventListener('click', () => {
    items.forEach((el) => el.classList.remove('is-active'));
    btn.classList.add('is-active');

    const target = document.getElementById(btn.dataset.target);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const accordions = document.querySelectorAll('.accordion');

  accordions.forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.nextElementSibling;
      panel.classList.toggle('open');
  });
});

});
