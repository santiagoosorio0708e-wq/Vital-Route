import { env } from '../config/env';
import { eventBus } from '../events/event-bus';
import { Topics } from '../events/topics';
import { advanceTowards, distanceKm } from './geo';
import type { Ambulance, Coordinates } from '../types/dispatch.types';

/**
 * Flota inicial repartida por alcaldías de Ciudad de México.
 * No existe una tabla de ambulancias en la Parte 1, así que el gateway mantiene
 * este estado en memoria y lo publica en tiempo real.
 */
const INITIAL_FLEET: Array<Pick<Ambulance, 'id' | 'plate'> & Coordinates> = [
  { id: 'AMB-01', plate: 'CDMX-4471', latitude: 19.4326, longitude: -99.1332 }, // Centro
  { id: 'AMB-02', plate: 'CDMX-8820', latitude: 19.3907, longitude: -99.2837 }, // Santa Fe
  { id: 'AMB-03', plate: 'CDMX-1159', latitude: 19.3467, longitude: -99.1013 }, // Coyoacán
  { id: 'AMB-04', plate: 'CDMX-6032', latitude: 19.4978, longitude: -99.1269 }, // Gustavo A. Madero
  { id: 'AMB-05', plate: 'CDMX-2748', latitude: 19.4284, longitude: -99.0570 }, // Iztapalapa
];

/** Velocidad de traslado simulada, con sirena y en tráfico de CDMX. */
const AVERAGE_SPEED_KMH = 45;

/** A menos de esta distancia se considera que la unidad llegó al hospital. */
const ARRIVAL_THRESHOLD_KM = 0.15;

class FleetService {
  private readonly ambulances = new Map<string, Ambulance>();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    const now = new Date().toISOString();
    for (const unit of INITIAL_FLEET) {
      this.ambulances.set(unit.id, {
        ...unit,
        status: 'available',
        assignedEmergencyId: null,
        destination: null,
        destinationClinicId: null,
        updatedAt: now,
      });
    }
  }

  list(): Ambulance[] {
    return [...this.ambulances.values()];
  }

  /**
   * Elige la unidad disponible más cercana al lugar de la emergencia.
   * Si todas están ocupadas, reasigna la más cercana de la flota completa: en
   * una urgencia es preferible redirigir una unidad a no enviar ninguna.
   */
  assignNearest(origin: Coordinates, emergencyId: string, destination: Coordinates, clinicId: number): Ambulance {
    const candidates = this.list().filter((a) => a.status === 'available');
    const pool = candidates.length > 0 ? candidates : this.list();

    const chosen = pool.reduce((best, current) =>
      distanceKm(origin, current) < distanceKm(origin, best) ? current : best
    );

    const assigned: Ambulance = {
      ...chosen,
      status: 'dispatched',
      assignedEmergencyId: emergencyId,
      destination: { ...destination },
      destinationClinicId: clinicId,
      updatedAt: new Date().toISOString(),
    };

    this.ambulances.set(assigned.id, assigned);
    return assigned;
  }

  /**
   * Arranca el reloj de la simulación. En cada tic mueve a las unidades
   * despachadas y publica su nueva posición en el bus.
   */
  startSimulation(): void {
    if (this.timer) return;

    const stepKm = (AVERAGE_SPEED_KMH * (env.fleetTickMs / 1000)) / 3600;

    this.timer = setInterval(() => {
      for (const ambulance of this.ambulances.values()) {
        if (ambulance.status !== 'dispatched' || !ambulance.destination) continue;

        const next = advanceTowards(ambulance, ambulance.destination, stepKm);
        const arrived = distanceKm(next, ambulance.destination) <= ARRIVAL_THRESHOLD_KM;

        const updated: Ambulance = {
          ...ambulance,
          latitude: next.latitude,
          longitude: next.longitude,
          status: arrived ? 'arrived' : 'dispatched',
          updatedAt: new Date().toISOString(),
        };

        this.ambulances.set(updated.id, updated);
        eventBus.publish(Topics.AMBULANCE_MOVED, updated);
      }
    }, env.fleetTickMs);

    // No impedir que el proceso termine si solo queda este intervalo vivo.
    this.timer.unref?.();
  }

  stopSimulation(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const fleetService = new FleetService();
