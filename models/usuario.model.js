const usuarios = [
  {
    correo: 'admin@ppg.com',
    password: '1234',
    nombre: 'Admin Marketing',
    rol: 'Marketing',
  },
];

module.exports = class Usuario {
  static validar(correo, password) {
    return usuarios.find(
      (u) => u.correo === correo && u.password === password
    );
  }
};

