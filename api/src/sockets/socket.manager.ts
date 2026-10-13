import type { Server, Socket } from 'socket.io';
import { clinicRepository } from '../services/clinic.repository';
import { fleetService } from '../services/fleet.service';
import type { ClientRole } from '../types/dispatch.types';

/**
 * Nombres de las salas. Una sala por destinatario real: así la alerta de trauma
 * llega solo al hospital que recibe al paciente y las coordenadas cifradas solo
 * a la tablet de la ambulancia asignada.
 */
export const Rooms = {
  commandCenter: () => 'command-center',
  ambulance: (id: string) => `ambulance:${id}`,
  clinic: (id: number | string) => `clinic:${id}`,
};

interface Handshake {
  role?: ClientRole;
  id?: string;
}

/**
 * Registra el ciclo de vida de las conexiones WebSocket.
 *
 * Cada cliente se identifica al conectarse (rol e id) y entra a su sala. Al
 * entrar recibe una foto del estado actual, para no arrancar con la pantalla
 * vacía mientras llega el primer evento.
 */
export function setupSockets(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    const { role = 'command-center', id } = (socket.handshake.auth ?? {}) as Handshake;

    switch (role) {
      case 'ambulance': {
        if (!id) {
          socket.emit('connection:rejected', {
            reason: 'Una ambulancia debe conectarse indicando su id de unidad.',
          });
          socket.disconnect(true);
          return;
        }
        await socket.join(Rooms.ambulance(id));
        break;
      }

      case 'clinic': {
        if (!id) {
          socket.emit('connection:rejected', {
            reason: 'Un hospital debe conectarse indicando su id de clínica.',
          });
          socket.disconnect(true);
          return;
        }
        await socket.join(Rooms.clinic(id));
        socket.emit('inventory:snapshot', [
          await clinicRepository.getInventory(Number(id)),
        ]);
        break;
      }

      default: {
        await socket.join(Rooms.commandCenter());
        socket.emit('fleet:snapshot', fleetService.list());
        socket.emit('clinics:snapshot', await clinicRepository.findAll());
        socket.emit('inventory:snapshot', await clinicRepository.getAllInventories());
        break;
      }
    }

    socket.emit('connection:ready', { role, id: id ?? null, socketId: socket.id });
    console.log(`[ws] Conectado ${role}${id ? ` (${id})` : ''} · ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[ws] Desconectado ${socket.id} · ${reason}`);
    });
  });
}
