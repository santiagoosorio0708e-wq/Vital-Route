import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Apunta al archivo .env global en la raíz del proyecto
dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Inicializar WebSockets para el Frontend Dashboard
const io = new Server(server, {
    cors: { origin: '*' }
});

// ==========================================
// TODO (Dev B): Implementar Rutas y Sockets
// ==========================================
// Ejemplo: 
// import emergencyRoutes from './controllers/emergency.controller';
// app.use('/api/v1/emergencies', emergencyRoutes);
//
// import { setupSockets } from './sockets/socket';
// setupSockets(io);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'API Gateway Node.js' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 API Gateway & WebSockets (Dev B) running on port ${PORT}`);
});
