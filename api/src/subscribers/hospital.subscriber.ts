import type { Server } from 'socket.io';
import { eventBus } from '../events/event-bus';
import { Topics } from '../events/topics';
import { clinicRepository } from '../services/clinic.repository';
import { Rooms } from '../sockets/socket.manager';

/** Minutos estimados de llegada, a 45 km/h promedio con sirena. */
const estimateMinutes = (distanceKm: number): number =>
  Math.max(1, Math.round((distanceKm / 45) * 60));

/**
 * Suscriptor 2 de la decisión de despacho: la pantalla del hospital destino.
 *
 * Levanta la alerta de "Trauma Entrante" y, acto seguido, vuelve a leer el
 * inventario de esa clínica. El core de Python ya descontó el recurso al
 * reservarlo, así que esta lectura refleja la existencia real y se publica
 * para que los tableros se actualicen sin recargar la página.
 */
export function registerHospitalSubscriber(io: Server): void {
  eventBus.subscribe(Topics.DISPATCH_DECIDED, async (decision) => {
    const alert = {
      type: 'TRAUMA_ENTRANTE' as const,
      emergencyId: decision.emergencyId,
      severity: decision.severity,
      triageScore: decision.triageScore,
      patientName: decision.patientName,
      symptoms: decision.symptoms,
      ambulanceId: decision.ambulance.id,
      ambulancePlate: decision.ambulance.plate,
      distanceKm: decision.distanceKm,
      etaMinutes: estimateMinutes(decision.distanceKm),
      raisedAt: decision.decidedAt,
    };

    const clinicRoom = Rooms.clinic(decision.clinic.id);
    io.to(clinicRoom).emit('alert:incoming-trauma', alert);
    // El centro de mando ve todas las alertas de la red.
    io.to(Rooms.commandCenter()).emit('alert:incoming-trauma', {
      ...alert,
      clinicId: decision.clinic.id,
      clinicName: decision.clinic.name,
    });

    console.log(
      `[alerta] Trauma entrante en ${decision.clinic.name} · ETA ${alert.etaMinutes} min`
    );

    const inventory = await clinicRepository.getInventory(decision.clinic.id);
    if (inventory) {
      eventBus.publish(Topics.INVENTORY_CHANGED, inventory);
    }
  });
}
