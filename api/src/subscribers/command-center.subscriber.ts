import type { Server } from 'socket.io';
import { eventBus } from '../events/event-bus';
import { Topics } from '../events/topics';
import { Rooms } from '../sockets/socket.manager';

/**
 * Suscriptor 3: el centro de mando.
 *
 * Es el único que ve la red completa. Recibe cada despacho, cada movimiento de
 * la flota y cada cambio de inventario para pintarlos en el mapa y los tableros.
 */
export function registerCommandCenterSubscriber(io: Server): void {
  eventBus.subscribe(Topics.DISPATCH_DECIDED, (decision) => {
    io.to(Rooms.commandCenter()).emit('dispatch:created', decision);
  });

  eventBus.subscribe(Topics.AMBULANCE_MOVED, (ambulance) => {
    io.to(Rooms.commandCenter()).emit('fleet:position', ambulance);

    // La propia unidad también sigue su posición en la tablet.
    io.to(Rooms.ambulance(ambulance.id)).emit('fleet:position', ambulance);
  });

  eventBus.subscribe(Topics.INVENTORY_CHANGED, (inventory) => {
    io.to(Rooms.commandCenter()).emit('inventory:update', inventory);
    io.to(Rooms.clinic(inventory.clinicId)).emit('inventory:update', inventory);
  });
}
