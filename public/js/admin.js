// public/js/admin.js
document.addEventListener("DOMContentLoaded", () => {
    cargarMensajes();
    cargarUsuarios();
});

function cargarMensajes() {
    fetch('/api/mensajes')
        .then(response => response.json())
        .then(data => {
            const listaMensajes = document.getElementById('lista-mensajes');
            listaMensajes.innerHTML = data.map(msg => `<p>${msg.contenido}</p>`).join('');
        })
        .catch(error => console.error('Error al cargar mensajes:', error));
}

function cargarUsuarios() {
    fetch('/api/usuarios')
        .then(response => response.json())
        .then(data => {
            const listaUsuarios = document.getElementById('lista-usuarios');
            listaUsuarios.innerHTML = data.map(user => `<p>${user.nombre}</p>`).join('');
        })
        .catch(error => console.error('Error al cargar usuarios:', error));
}
