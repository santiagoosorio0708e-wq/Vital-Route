import type { Server } from 'socket.io';
import { eventBus } from '../events/event-bus';
import { Topics } from '../events/topics';
import { cryptoService } from '../services/crypto.service';
import { Rooms } from '../sockets/socket.manager';

/**
 * Suscriptor 1 de la decisión de despacho: la tablet del paramédico.
 *
 * Recibe la ruta con las coordenadas cifradas. Los datos del paciente van en
 * el mismo paquete cifrado, porque son información clínica sensible.
 */
export function registerParamedicSubscriber(io: Server): void {
  eventBus.subscribe(Topics.DISPATCH_DECIDED, (decision) => {
    const encrypted = cryptoService.encrypt({
      emergencyId: decision.emergencyId,
      patient: {
        name: decision.patientName,
        symptoms: decision.symptoms,
        severity: decision.severity,
        triageScore: decision.triageScore,
      },
      pickup: decision.origin,
      destination: {
        clinicId: decision.clinic.id,
        clinicName: decision.clinic.name,
        address: decision.clinic.address,
        latitude: decision.clinic.latitude,
        longitude: decision.clinic.longitude,
      },
      distanceKm: decision.distanceKm,
    });

    // Fuera del sobre cifrado solo viaja lo mínimo para enrutar el mensaje.
    io.to(Rooms.ambulance(decision.ambulance.id)).emit('dispatch:assignment', {
      emergencyId: decision.emergencyId,
      ambulanceId: decision.ambulance.id,
      issuedAt: decision.decidedAt,
      payload: encrypted,
    });

    console.log(
      `[despacho] Ruta cifrada enviada a ${decision.ambulance.id} · emergencia ${decision.emergencyId}`
    );
  });
}
