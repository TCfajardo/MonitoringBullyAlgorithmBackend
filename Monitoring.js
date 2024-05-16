require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
app.use(express.json());
const server = http.createServer(app);

// Crear una instancia del servidor WebSocket
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
let usedNodeIDs = [];
const nodeSocketMap = new Map();

// Manejar conexiones de nodos
io.on('connection', (socket) => {
    const origin = socket.handshake.query.clientUrl || 'unknown';
    console.log(`[${getCurrentTime()}] Nuevo nodo conectado desde: ${origin}`);
    io.emit('logs', { message: `[${getCurrentTime()}] Nuevo cliente conectado desde: ${origin}` });
    nodeSocketMap.set(origin, socket.id);

    socket.on('disconnect', () => {
        console.log(`[${getCurrentTime()}] Cliente ${origin} desconectado.`);
        io.emit('logs', { message: `[${getCurrentTime()}] Cliente ${origin} desconectado.` });
        nodeSocketMap.delete(origin);
        // Enviar la lista de servidores actualizada a todos los nodos cuando un cliente se desconecta
        socket.emit('servers_list', SERVERS);
    });

    // Enviar la lista de servidores actualizada al nuevo nodo cuando se conecta
    socket.emit('servers_list', SERVERS);

    socket.on('update-nodes-list', (data) => {
        SERVERS = data.nodes;
        // Envía la lista actualizada de nodos a todos los clientes conectados
        io.emit('servers_list', SERVERS);
    });

    socket.on('update-node-info', (data) => {
        const { clientUrl, imLeader } = data;
        const nodeIndex = SERVERS.findIndex(node => node.clientUrl === clientUrl);
        if (nodeIndex !== -1) {
            SERVERS[nodeIndex].imLeader = imLeader;
            // Después de actualizar la información del nodo, enviar la lista actualizada a todos los clientes
            io.emit('servers_list', SERVERS);
            console.log(`Información del nodo actualizada: ${clientUrl} es líder: ${imLeader}`);
            io.emit('logs', { message: `[${getCurrentTime()}] Nodo ${clientUrl} es líder: ${imLeader}` });
        } else {
            console.error(`No se encontró el nodo con la URL: ${clientUrl}`);
        }
    });

    // Manejar mensajes recibidos del nodo
    socket.on('node_data', async (data) => {
        console.log('Datos recibidos del nodo:', data);
        const existingNodeIndex = SERVERS.findIndex(node => node.clientUrl === data.clientUrl);
        if (existingNodeIndex !== -1) {
            SERVERS[existingNodeIndex].isActive = true;
        } else {
            SERVERS.push({
                clientUrl: data.clientUrl,
                imLeader: data.imLeader,
                id: data.id,
                isActive: true,
            });
        }
        // Enviar la lista de servidores actualizada a todos los nodos cuando se recibe nuevo data de un nodo
        socket.emit('servers_list', SERVERS);
    });

    // Detener un nodo
    socket.on('stop_node', (nodeId) => {
        const node = SERVERS.find(node => node.id === nodeId);
        if (node) {
            node.isActive = false;
            // Enviar solicitud al cliente Node para cambiar el estado
            axios.post(`${node.clientUrl}/set-inactive`)
                .then(response => {
                    console.log(response.data);
                })
                .catch(error => {
                    console.error(`Error al enviar solicitud al cliente Node: ${error.message}`);
                });
            console.log(`[${getCurrentTime()}] Nodo ${node.clientUrl} apagado.`);
            io.emit('logs', { message: `[${getCurrentTime()}] Nodo ${node.clientUrl} apagado` });
            console.log('Servers data', SERVERS);
            socket.emit('servers_list', SERVERS);
        }
    });
});

async function updateNodes() {
    try {
        io.emit('servers_list', SERVERS);
        io.emit('node_data_to_vue', SERVERS);
        console.log(`[${getCurrentTime()}] Enviando lista de servidores actualizada a todos los nodos`);
    } catch (error) {
        console.error(`Error al enviar lista de servidores actualizada: ${error.message}`);
    }
}
setInterval(updateNodes, 3000);

async function isNodeActive(node) {
    try {
        const response = await axios.get(`${node.clientUrl}/ping`);
        return response.data === 'pong';
    } catch (error) {
        console.error(`Error al enviar solicitud /ping a ${node.clientUrl}: ${error.message}`);
        return false;
    }
}

async function pingNodos() {
    for (const node of SERVERS) {
        try {
            const isActive = await isNodeActive(node);
            if (isActive) {
                console.log(`[${getCurrentTime()}] Ping a nodo ${node.clientUrl} está activo`);
            } else {
                console.error(`[${getCurrentTime()}] Error en el ping, nodo ${node.clientUrl} no está activo`);
            }
            console.log('node ping ', node);
            node.isActive = isActive;
        } catch (error) {
            console.error(`Error al verificar el estado del nodo ${node.clientUrl}: ${error.message}`);
            node.isActive = false;
        }
    }
}

setInterval(pingNodos, 4000);

function getCurrentTime() {
    return new Date().toLocaleTimeString();
}

const path = require('path');

const generateNodeId = (usedNodeIDs) => {
    let nodeId;
    do {
        nodeId = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
    } while (usedNodeIDs.includes(nodeId));
    usedNodeIDs.push(nodeId);
    return nodeId;
};

app.post('/crear-nuevo-nodo', (req, res) => {
    const usedNodeIDs = [parseInt(process.env.NODE_ID)]; // Initialize with existing NODE_ID
    const NODE_PORT = parseInt(process.env.NODE_PORT) + 1;
    const NODE_IP = process.env.NODE_IP || 'localhost';
    const NODE_ID = generateNodeId(usedNodeIDs);

    console.log('Nuevo NODE_ID:', NODE_ID);

    const IP_SW = process.env.IP_SW || 'http://localhost:4000';

    const filePath = path.join(__dirname, '../BullyNodes/BullyNodes.js');
    const command = `start cmd /k node ${filePath} ${NODE_PORT} ${NODE_IP} ${NODE_ID} ${IP_SW}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al ejecutar el comando: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error en la salida estándar: ${stderr}`);
            return;
        }
        console.log(`Nodo creado con éxito. Puerto: ${NODE_PORT}, ID: ${NODE_ID}`);
    });

    process.env.NODE_PORT = NODE_PORT.toString();
    process.env.NODE_ID = NODE_ID.toString();

    res.send('Nuevo nodo en proceso de creación...');
});


const port = process.env.PORT || 4000;
server.listen(port, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${port}`);
});
