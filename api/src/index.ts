import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

import { env } from './config/env';
import { setupSockets } from './sockets/socket.manager';
import { registerSubscribers } from './subscribers';
import { fleetService } from './services/fleet.service';
import dispatchRoutes from './controllers/dispatch.controller';
import networkRoutes from './controllers/network.controller';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

/**
 * WebSockets sobre la misma instancia HTTP.
 *
 * Socket.IO negocia WebSocket y mantiene la conexión TCP abierta, así que el
 * servidor empuja los datos en cuanto ocurren en lugar de esperar a que el
 * cliente pregunte cada pocos segundos.
 */
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  pingInterval: 20_000,
  pingTimeout: 25_000,
});

setupSockets(io);
registerSubscribers(io);
fleetService.startSimulation();

app.use('/api/v1/dispatch', dispatchRoutes);
app.use('/api/v1/network', networkRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'API Gateway Node.js',
    connectedClients: io.engine.clientsCount,
    coreUrl: env.pythonCoreUrl,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

server.listen(env.port, () => {
  console.log(`API Gateway y WebSockets escuchando en el puerto ${env.port}`);
  console.log(`Motor de decisión (core Python): ${env.pythonCoreUrl}`);
  if (env.enableDispatchDrill) {
    console.log('Simulacro habilitado en POST /api/v1/dispatch/drill');
  }
});

/** Apagado ordenado: se cierran los sockets antes de matar el proceso. */
function shutdown(signal: string): void {
  console.log(`\n${signal} recibido, cerrando el gateway...`);
  fleetService.stopSimulation();
  io.close(() => server.close(() => process.exit(0)));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
