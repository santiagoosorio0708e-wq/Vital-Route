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

/** A menos de esta distancia se considera que la unidad llegó a su punto. */
const ARRIVAL_THRESHOLD_KM = 0.15;

/**
 * Cuánto se queda la unidad en el hospital antes de volver a estar disponible.
 * En la vida real es el tiempo de entrega del paciente y limpieza; aquí sirve
 * para que la flota no se agote después de unos cuantos despachos.
 */
const TURNAROUND_MS = 15_000;

class FleetService {
  private readonly ambulances = new Map<string, Ambulance>();
  /** Momento en que cada unidad llegó al hospital, para liberarla después. */
  private readonly arrivedAt = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    const now = new Date().toISOString();
    for (const unit of INITIAL_FLEET) {
      this.ambulances.set(unit.id, {
        ...unit,
        status: 'available',
        leg: null,
        pickup: null,
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
   *
   * La unidad arranca en el tramo hacia el paciente. El hospital queda
   * guardado como destino final, pero no se va para allá hasta recogerlo.
   */
  assignNearest(
    origin: Coordinates,
    emergencyId: string,
    destination: Coordinates,
    clinicId: number
  ): Ambulance {
    const candidates = this.list().filter((a) => a.status === 'available');
    const pool = candidates.length > 0 ? candidates : this.list();

    const chosen = pool.reduce((best, current) =>
      distanceKm(origin, current) < distanceKm(origin, best) ? current : best
    );

    const assigned: Ambulance = {
      ...chosen,
      status: 'dispatched',
      leg: 'to_patient',
      pickup: { ...origin },
      assignedEmergencyId: emergencyId,
      destination: { latitude: destination.latitude, longitude: destination.longitude },
      destinationClinicId: clinicId,
      updatedAt: new Date().toISOString(),
    };

    this.arrivedAt.delete(assigned.id);
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
        if (ambulance.status === 'arrived') {
          this.releaseIfRested(ambulance);
          continue;
        }

        if (ambulance.status !== 'dispatched') continue;

        // Hacia dónde va ahora mismo: al paciente o, ya con él a bordo, al hospital.
        const target =
          ambulance.leg === 'to_patient' ? ambulance.pickup : ambulance.destination;
        if (!target) continue;

        const next = advanceTowards(ambulance, target, stepKm);
        const reached = distanceKm(next, target) <= ARRIVAL_THRESHOLD_KM;

        let updated: Ambulance = {
          ...ambulance,
          latitude: next.latitude,
          longitude: next.longitude,
          updatedAt: new Date().toISOString(),
        };

        if (reached && ambulance.leg === 'to_patient') {
          // Paciente a bordo: empieza el traslado.
          updated = { ...updated, leg: 'to_hospital' };
          console.log(
            `[flota] ${updated.id} recogio al paciente, traslado al hospital en curso`
          );
        } else if (reached && ambulance.leg === 'to_hospital') {
          updated = { ...updated, status: 'arrived', leg: null };
          this.arrivedAt.set(updated.id, Date.now());
          console.log(`[flota] ${updated.id} entrego al paciente en el hospital`);
        }

        this.ambulances.set(updated.id, updated);
        eventBus.publish(Topics.AMBULANCE_MOVED, updated);
      }
    }, env.fleetTickMs);

    // No impedir que el proceso termine si solo queda este intervalo vivo.
    this.timer.unref?.();
  }

  /** Devuelve al servicio una unidad que ya descansó lo suficiente. */
  private releaseIfRested(ambulance: Ambulance): void {
    const since = this.arrivedAt.get(ambulance.id);
    if (since === undefined || Date.now() - since < TURNAROUND_MS) return;

    const free: Ambulance = {
      ...ambulance,
      status: 'available',
      leg: null,
      pickup: null,
      assignedEmergencyId: null,
      destination: null,
      destinationClinicId: null,
      updatedAt: new Date().toISOString(),
    };

    this.arrivedAt.delete(ambulance.id);
    this.ambulances.set(free.id, free);
    eventBus.publish(Topics.AMBULANCE_MOVED, free);
    console.log(`[flota] ${free.id} disponible de nuevo`);
  }

  stopSimulation(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const fleetService = new FleetService();
