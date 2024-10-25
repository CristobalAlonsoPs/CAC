const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const session = require('express-session');

require('dotenv').config();

app.use(express.static('public'));

// Conexion a mongo

// mongoose.connect('mongodb+srv://crprez18:Jordanretro11@cluster0.uwq62.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0s')
//     .then(() => console.log('Conectado a MongoDB'))
//     .catch(err => console.error('Error al conectar a MongoDB:', err));
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error al conectar a MongoDB:', err));

// Modelo de usuario
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verificationToken: { type: String },
    verified: { type: Boolean, default: false },
    role: { type: String, default: 'user' }
});

const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'mi_secreto',
    resave: false,
    saveUninitialized: false
}));

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cr.prez18@gmail.com',
        pass: 'uaxs dvqq kusq nght'
    }
});

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Ruta para la página de "Nuestros Trabajos"
app.get('/trabajos', (req, res) => {
    res.sendFile(__dirname + '/views/trabajos.html');
});


// Ruta para el login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.send('<h1>Error: Usuario no encontrado</h1>');
    }

    if (!user.verified) {
        return res.send('<h1>Error: Verifica tu correo antes de iniciar sesión.</h1>');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.send('<h1>Error: Contraseña incorrecta</h1>');
    }

    req.session.userId = user._id;
    req.session.email = user.email;
    req.session.role = user.role;

    res.redirect('/mi-cuenta');
});

// Ruta para registro
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/registro.html');
});

// Procesar el formulario de registro
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.send('<h1>Error: El correo ya está registrado.</h1>');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex'); 
    console.log(`Token de verificación generado: ${verificationToken}`);

    const user = new User({
        email,
        password: hashedPassword,
        verificationToken,
        verified: false
    }); 

    try {
        await user.save();

        const mailOptions = {
            from: 'cr.prez18@gmail.com',
            to: email,
            subject: 'Verificación de Correo',
            text: `Verifica tu cuenta haciendo clic en el siguiente enlace: http://localhost:3000/verify/${verificationToken}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.error('Error al enviar el correo de verificación:', error);
            }
            console.log('Correo de verificación enviado:', info.response);
        });

        res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        <div class="container mt-5 text-center">
            <h1>Gracias por registrarte, ${email}!</h1>
            <p>Revisa tu correo para verificar tu cuenta.</p>
        </div>`);

    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        res.send('<h1>Error al registrar el usuario.</h1>');
    }
});

// Verificar correo
app.get('/verify/:token', async (req, res) => {
    const { token } = req.params;
    console.log(`Token recibido en la URL: ${token}`);

    try {
        const user = await User.findOne({ verificationToken: token });
        console.log(`Usuario encontrado: ${user}`);

        if (!user) {
            return res.send('<h1>Error: Token de verificación inválido.</h1>');
        }

        // Actualizar el estado de verificación y eliminar el token
        user.verified = true;
        user.verificationToken = '';  // Asignamos una cadena vacía en lugar de null o undefined
        await user.save();
        
        res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        <div class="container mt-5 text-center">
            <h1>¡Correo verificado! Ahora puedes iniciar sesión.</h1>
            <a href="/login" class="btn btn-primary">Iniciar Sesión</a>
        </div>`);

    } catch (error) {
        console.error('Error al verificar el token:', error);
        res.send('<h1>Error al verificar el token.</h1>');
    }
});

// Middleware de autenticación
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Ruta para "Mi Cuenta"
app.get('/mi-cuenta', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    
    if (!user) {
        return res.send('<h1>Error: Usuario no encontrado.</h1>');
    }

    const messages = await Message.find({ sender: user.email }).sort({ timestamp: -1 });

    // Puedes pasar la información del usuario y los mensajes directamente a tu HTML
    res.sendFile(__dirname + '/views/miCuenta.html');
});

// Ruta API para enviar datos del usuario y mensajes
app.get('/api/mi-cuenta-data', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const messages = await Message.find({ sender: user.email }).sort({ timestamp: -1 });
    
    res.json({
        email: user.email,
        role: user.role,
        messages: messages
    });
});



// Procesar el envío de mensajes
app.post('/mi-cuenta', isAuthenticated, async (req, res) => {
    const { message } = req.body;

    const newMessage = new Message({
        sender: req.session.email, // Correo del usuario que envía el mensaje
        content: message
    });

    try {
        await newMessage.save();

        // Configurar el correo para el administrador
        const mailOptions = {
            from: 'cr.prez18@gmail.com', // Correo del remitente (tu Gmail)
            to: 'cr.prez18@gmail.com', // Correo del administrador
            subject: `Nuevo mensaje de ${req.session.email}`, // Asunto del correo
            text: `Has recibido un nuevo mensaje de ${req.session.email}:\n\n${message}` // Cuerpo del correo
        };

        // Enviar el correo
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error al enviar el correo al administrador:', error);
                return res.send('<h1>Error al enviar el mensaje.</h1>');
            }
            console.log('Correo enviado al administrador:', info.response);
            res.redirect('/mi-cuenta'); // Redirigir después de enviar
        });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        res.send('<h1>Error al enviar el mensaje.</h1>');
    }
});



// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
