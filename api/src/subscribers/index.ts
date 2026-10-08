import type { Server } from 'socket.io';
import { registerParamedicSubscriber } from './paramedic.subscriber';
import { registerHospitalSubscriber } from './hospital.subscriber';
import { registerCommandCenterSubscriber } from './command-center.subscriber';

/**
 * Da de alta a todos los suscriptores del bus.
 *
 * Agregar un nuevo destinatario (por ejemplo, un SMS al familiar) es crear un
 * archivo más y registrarlo aquí: el publicador no cambia.
 */
export function registerSubscribers(io: Server): void {
  registerParamedicSubscriber(io);
  registerHospitalSubscriber(io);
  registerCommandCenterSubscriber(io);
}
