// usuario.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    nombre: String,
    correo: String,
    contrasena: String,
});

module.exports = mongoose.model('Usuario', usuarioSchema);
