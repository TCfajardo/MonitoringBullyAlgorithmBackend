require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Lista de nodos para monitoreo
const nodos = [
    'http://localhost:5001',
    'http://localhost:5002',
];

// Función para verificar si un nodo está activo
function isNodeActive(nodo) {
    return new Promise((resolve, reject) => {
        axios.get(`${nodo}/ping`)
            .then((response) => {
                if (response.data === 'pong') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

// Función para enviar una solicitud /ping a un nodo y verificar si está activo
async function pingNodo(nodo) {
    try {
        const isActive = await isNodeActive(nodo);
        if (isActive) {
            console.log(`Nodo ${nodo} está activo`);
        } else {
            console.error(`Nodo ${nodo} no está activo`);
        }
    } catch (error) {
        console.error(`Error al enviar solicitud /ping a ${nodo}: ${error.message}`);
    }
}

// Función para enviar solicitudes /ping a todos los nodos
function pingNodos() {
    nodos.forEach(pingNodo);
}

// Programar la función pingNodos para que se ejecute cada 4 segundos
setInterval(pingNodos, 4000);

wss.on('connection', (ws, req) => {
    console.log('Cliente conectado');

    const clientIp = req.socket.remoteAddress;
    console.log('Dirección IP del cliente:', clientIp);

    ws.on('close', () => {
        console.log('Cliente desconectado');
    });

    ws.on('message', (message) => {
        console.log('Mensaje recibido:', message);
    });
});

const port = process.env.PORT || 4000;
server.listen(port, () => {
    console.log(`Servidor WebSocket corriendo en http://localhost:${port}`);
});