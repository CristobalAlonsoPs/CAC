// adminController.js
const User = require('./usuario');
const Message = require('./mensaje'); 

// Función para obtener usuarios
async function getUsers(req, res) {
    try {
        const users = await User.find(); // Aquí se obtienen todos los usuarios
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
}

// Función para obtener mensajes
async function getMessages(req, res) {
    try {
        const messages = await Message.find(); // Aquí se obtienen todos los mensajes
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener mensajes' });
    }
}

module.exports = {
    getUsers,
    getMessages
};
