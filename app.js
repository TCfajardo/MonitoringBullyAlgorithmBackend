require('dotenv').config();
const express = require('express');
const http = require('http');
const axios = require('axios');
const { Server } = require('socket.io');

const app = express();
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }
});

// Lista de nodos para monitoreo
const SERVERS = [];
let LEADER_URL = null; // Variable para almacenar la URL del líder

const nodeSocketMap = new Map();
function getCurrentTime() {
    return new Date().toLocaleTimeString();
}

io.on('connection', (socket) => {
    const origin = socket.handshake.query.clientUrl || 'unknown';
    const connectionLog = `[${getCurrentTime()}] Nuevo cliente conectado desde: ${origin}`;
    console.log(connectionLog);
    io.emit('logs', { message: connectionLog });
    nodeSocketMap.set(origin, socket.id);

    socket.on('disconnect', () => {
        const disconnectionLog = `[${getCurrentTime()}] Cliente ${origin} desconectado.`;
        console.log(disconnectionLog);
        io.emit('logs', { message: disconnectionLog });
        nodeSocketMap.delete(origin);
    });
});

// Función para verificar si un nodo está activo
async function isNodeActive(nodo) {
    try {
        const response = await axios.get(`${nodo}/ping`);
        return response.data === 'pong';
    } catch (error) {
        console.error(`Error al enviar solicitud /ping a ${nodo}: ${error.message}`);
        return false;
    }
}

// Función para enviar solicitudes /ping a todos los nodos
async function pingNodos() {
    for (const nodo of SERVERS) {
        try {
            const isActive = await isNodeActive(nodo);
            if (isActive) {
                console.log(`Nodo ${nodo} está activo`);
            } else {
                console.error(`Nodo ${nodo} no está activo`);
            }
        } catch (error) {
            console.error(`Error al verificar el estado del nodo ${nodo}: ${error.message}`);
        }
    }
}

// Programar la función pingNodos para que se ejecute cada 4 segundos
setInterval(pingNodos, 4000);


// Endpoint para que el nodo solicite la información de liderazgo
app.get('/leader-info', (req, res) => {
    res.json({ leaderUrl: LEADER_URL });
});

// Función para actualizar la lista de servidores y almacenar la URL del líder si corresponde
function updateServers(ip, port, leader) {
    try {
        const newServer = `http://${ip}:${port}`;
        if (!SERVERS.includes(newServer)) {
            SERVERS.push(newServer);
            console.log("Lista de IP y Puertos actualizada:");
            console.log(SERVERS);

            // Enviar la lista actualizada de servidores a todos los nodos
            SERVERS.forEach((serverUrl) => {
                axios.post(`${serverUrl}/update-server-list`, { servers: SERVERS })
                    .then((response) => {
                        console.log("Lista de servidores enviada a:", serverUrl);
                        console.log("Respuesta del nodo:", response.data);
                    })
                    .catch((error) => {
                        console.error("Error al enviar la lista de servidores al nodo:", error.message);
                    });
            });

            // Verificar si hay un líder establecido
            if (!LEADER_URL) {
                LEADER_URL = newServer;
                console.log("URL del líder actualizada:", LEADER_URL);
            } else if (LEADER_URL === newServer) {
                LEADER_URL = newServer;
                console.log("URL del líder actualizada:", LEADER_URL);
            }
        }
    } catch (error) {
        console.error('Error al actualizar SERVERS:', error);
    }
}



app.post('/register-node', (req, res) => {
    if (!req.body || !req.body.ip || !req.body.port) {
        return res.status(400).send('Solicitud de cuerpo no válido');
    }
    const { ip, port, leader } = req.body;
    updateServers(ip, port, leader);
    console.log(`Nodo registrado: IP ${ip}, Puerto ${port}`);
    res.status(200).send('Nodo registrado exitosamente');
});

// Método para manejar la actualización de la URL del líder en el monitor
app.post('/leader-update', (req, res) => {
    const { leader } = req.body;
    LEADER_URL = leader; // Actualizar la URL del líder en el monitor
    console.log("URL del líder actualizada en el monitor:", LEADER_URL);
    res.status(200).send('URL del líder actualizada exitosamente en el monitor');
});



const port = process.env.PORT || 4000;
server.listen(port, () => {
    console.log(`Servidor WebSocket corriendo en http://localhost:${port}`);
});
