const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const session = require('express-session');
const path = require('path');

//Importacion de modelos
const Mensaje = require('./public/js/mensaje');
const Usuario = require('./public/js/usuario');

const app = express();
app.use(express.static('public'));

const adminRoutes = require('./public/js/adminController');


// Conexión a MongoDB
require('dotenv').config();
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

const User = mongoose.model('User', userSchema, 'users');

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema, 'messages');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'mi_secreto',
    resave: false,
    saveUninitialized: true,
}));


// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});
// Funcion para enviar correo
async function enviarCorreo(destinatario, mensaje) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: destinatario,
        subject: 'Respuesta de C.A.C. Refrigeración y Climatización SpA',
        text: mensaje,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado:', info.response);
    } catch (error) {
        console.error('Error al enviar el correo:', error.message); // Mejora la salida de error
    }
}

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
        return res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: Usuario no encontrado</h1>
            </div>`);
    }

    if (!user.verified) {
        return res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: Verifica tu correo antes de iniciar sesión.</h1>
            </div>`);
    }

    const validPassword = await bcryptjs.compare(password, user.password);
    if (!validPassword) {
        return res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: Contraseña incorrecta</h1>
                <a href="/login" class="btn btn-primary">Volver</a>
            </div>`);
        
    }

    req.session.userId = user._id;
    req.session.email = user.email;
    req.session.role = user.role;

    res.redirect('/mi-cuenta');
});

// Ruta para registro
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'registro.html'));
});

// Procesar el formulario de registro
app.post('/register', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: Las contraseñas no coinciden.</h1>
                <a href="/register" class="btn btn-primary">Volver</a>
            </div>
        `);
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un número.</h1>
                <a href="/register" class="btn btn-primary">Volver</a>
            </div>
        `);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: El correo ya está registrado.</h1>
                <a href="/register" class="btn btn-primary">Volver</a>
            </div>
        `);
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex'); 

    const user = new User({
        email,
        password: hashedPassword,
        verificationToken,
        verified: false
    }); 

    try {
        await user.save();

        await enviarCorreo(email, `Verifica tu cuenta haciendo clic en el siguiente enlace: http://localhost:3000/verify/${verificationToken}`);

        const mailOptions = {
            from: process.env.EMAIL_USER,
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

        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Gracias por registrarte, ${email}!</h1>
                <p>Revisa tu correo para verificar tu cuenta.</p>
            </div>
        `);

    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        res.send('<h1>Error al registrar el usuario.</h1>');
    }
});

// Verificar correo
app.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.send('<h1>Error: Token de verificación inválido.</h1>');
        }

        user.verified = true;
        user.verificationToken = '';  
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
// Middleware para proteger rutas
function isAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') {
        return next();
    } else {
        return res.status(403).send('Acceso denegado');
    }
}


app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcryptjs.compare(password, user.password))) {
        req.session.userId = user._id;
        req.session.email = user.email;
        req.session.role = user.role;

        // Redirigir según rol
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/mi-cuenta');
        }
    } else {
        res.status(401).send('Credenciales inválidas');
    }
});
;


// Rutas de API para mensajes y usuarios
app.get('/api/mensajes', async (req, res) => {
    try {
        const mensajes = await Message.find(); 
        res.json(mensajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los mensajes' });
    }
});


app.get('/api/usuarios', async (req, res) => {
    try {
        const usuarios = await User.find(); 
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los usuarios' });
    }
});
app.post('/responderMensaje', async (req, res) => {
    const { sender, content } = req.body;

    const respuesta = new Message({
        sender,
        content,
    });

    try {
        await respuesta.save();
        // Envía un correo al destinatario después de guardar el mensaje
        await enviarCorreo(sender, `Tienes una nueva respuesta: ${content}`);
        res.status(200).send('Respuesta enviada');
    } catch (error) {
        console.error('Error al enviar la respuesta:', error);
        res.status(500).send('Error al enviar la respuesta');
    }
});

function responderMensaje(id) {
    const mensaje = prompt("Escribe tu respuesta:");

    if (mensaje) {
        fetch(`/api/responder/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: mensaje })
        })
        .then(response => {
            console.log('Estado de respuesta:', response.status); // Imprimir el estado de la respuesta
            return response.json(); // Convierte la respuesta a JSON
        })
        .then(data => {
            if (data.error) {
                alert(data.error); // Muestra el error si existe
            } else {
                alert("Respuesta enviada correctamente.");
            }
        })
        .catch(error => console.error('Error:', error));
    }
}

app.post('/api/responder/:id', async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    try {
        // Encuentra el mensaje original
        const mensajeOriginal = await Message.findById(id);
        if (!mensajeOriginal) {
            return res.status(404).json({ error: 'Mensaje original no encontrado' });
        }

        // Crea una nueva respuesta
        const respuesta = new Message({
            sender: process.env.EMAIL_USER, // Asegúrate de cambiar esto al email del usuario
            content: text,
            recipientEmail: mensajeOriginal.sender // Guarda el email del remitente original
        });

        await respuesta.save();

        // Envía un correo al remitente original
        await enviarCorreo(mensajeOriginal.sender, `Tienes una nueva respuesta: ${text}`);

        res.status(201).json(respuesta);
    } catch (error) {
        console.error('Error al responder el mensaje:', error);
        res.status(500).json({ error: 'Error al responder el mensaje' });
    }
});


// Ruta para "Mi Cuenta"
app.get('/mi-cuenta', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    
    if (!user) {
        return res.send('<h1>Error: Usuario no encontrado.</h1>');
    }

    const messages = await Message.find({ sender: user.email }).sort({ timestamp: -1 });

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
        sender: req.session.email,
        content: message
    });

    try {
        await newMessage.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Nuevo mensaje de ${req.session.email}`,
            text: `Has recibido un nuevo mensaje de ${req.session.email}:\n\n${message}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error al enviar el correo al administrador:', error);
                return res.send('<h1>Error al enviar el mensaje.</h1>');
            }
            console.log('Correo enviado al administrador:', info.response);
            res.redirect('/mi-cuenta'); 
        });

    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        res.send('<h1>Error al enviar el mensaje.</h1>');
    }
});

// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return console.error('Error al cerrar sesión:', err);
        }
        res.redirect('/');
    });
});

// Ruta para solicitar restablecimiento de contraseña
app.get('/forgot-password', (req, res) => {
    console.log("Accediendo a la página de solicitud de restablecimiento de contraseña.");
    res.sendFile(__dirname + '/views/forgotPassword.html');
});

// Procesar solicitud de restablecimiento de contraseña
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log("Solicitud de restablecimiento de contraseña para el correo:", email);
    
    const user = await User.findOne({ email });

    if (!user) {
        console.log("Error: Usuario no encontrado");
        return res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        <h1 class="text-danger text-center">Error: Usuario no encontrado.</h1>`);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = resetToken;
    await user.save();
    console.log("Token de restablecimiento generado:", resetToken);

    const mailOptions = {
        from: 'cr.prez18@gmail.com',
        to: email,
        subject: 'Restablecimiento de Contraseña',
        text: `Haz clic en el siguiente enlace para restablecer tu contraseña: http://localhost:3000/reset/${resetToken}`
    };
    

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error al enviar el correo de restablecimiento:', error);
            return res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <h1 class="text-danger text-center">Error al enviar el correo de restablecimiento.</h1>`);
        }
        console.log('Correo de restablecimiento enviado:', info.response);
        res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        <div class="container mt-5 text-center">
            <h1>Te hemos enviado un correo para restablecer tu contraseña.</h1>
        </div>`);
    });
});

// Ruta para restablecer la contraseña usando el token
app.get('/reset/:token', async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
        return res.send('<h1>Error: Token inválido.</h1>');
    }

    // Enviar el archivo HTML para el formulario de nueva contraseña

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
        <link rel="stylesheet" href="/css/normalize.css">
        <link rel="stylesheet" href="/css/estilo.css">
    </head>
    <body>
        <header class="hero">
            <div class="container">
                <section class="form__registro">
                    <form action="/new-password/${token}" method="POST">
                        <div class="form__container">
                            <h3 class="form__ingresar">Restablecer Contraseña</h3>
                            <input type="hidden" name="token" value="${token}"> <!-- Campo oculto para el token -->
                            <input class="controls" type="password" name="password" placeholder="Nueva Contraseña" required>
                            <input class="controls" type="password" name="confirmPassword" placeholder="Confirmar Nueva Contraseña" required>
                            <button class="buttons" type="submit">Restablecer Contraseña</button>
                        </div>
                    </form>
                </section>
            </div>
        </header>
    </body>
    </html>
    `);
});


// Procesar la nueva contraseña
app.post('/new-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    console.log("Procesando nueva contraseña para el token:", token);
    //console.log("Contraseña nueva ingresada:", password);

    if (password !== confirmPassword) {
        console.log("Error: Las contraseñas no coinciden");
        res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: Las contraseñas no coinciden.</h1>
                <a href="/reset/${token}" class="btn btn-primary mt-3">Volver a intentar</a>
            </div>
        `);
        return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
        console.log("Error: La contraseña no cumple con los requisitos");
        return res.send(`
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <div class="container mt-5 text-center">
                <h1>Error: La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un número..</h1>
                <a href="/reset/${token}" class="btn btn-primary mt-3">Volver a intentar</a>
            </div>
        `);
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
        console.log("Error: Token inválido");
        return res.send('<h1>Error: Token inválido.</h1>');
    }

    user.password = await bcryptjs.hash(password, 10);
    user.verificationToken = '';
    await user.save();

    console.log("Contraseña restablecida con éxito.");
    res.send(`<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
        <div class="container mt-5 text-center">
            <h1>Contraseña restablecida con éxito. Ahora puedes iniciar sesión.</h1>
            <a href="/login" class="btn btn-primary">Iniciar Sesión</a>
        </div>`);

});


// Iniciar el servidor
app.listen(3000, () => {
    console.log('Servidor en ejecución en http://localhost:3000');
});
