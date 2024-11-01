// models/Mensaje.js
const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    text: { type: String, required: true },
    from: { type: String, required: true }, // Quién envía el mensaje
    to: { type: String, required: true },   // A quién se envía el mensaje
    recipientEmail: { type: String, required: true }, // Correo del destinatario
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mensaje', mensajeSchema, 'messages');
