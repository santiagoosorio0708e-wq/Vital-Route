import { agentService } from './agent.service';
import { clinicRepository } from './clinic.repository';
import { fleetService } from './fleet.service';
import { distanceKm } from './geo';
import { eventBus } from '../events/event-bus';
import { Topics } from '../events/topics';
import type {
  DispatchDecision,
  EmergencyRequest,
  Severity,
} from '../types/dispatch.types';

export class DispatchError extends Error {
  constructor(message: string, readonly statusCode = 502) {
    super(message);
    this.name = 'DispatchError';
  }
}

/**
 * Orquestador del despacho.
 *
 * Es el único punto donde se junta todo: pregunta al agente a qué hospital va
 * el paciente, le asigna la ambulancia más cercana y publica una sola decisión
 * en el bus. Quién reacciona a esa decisión no es asunto suyo.
 */
class DispatchService {
  async dispatch(request: EmergencyRequest): Promise<DispatchDecision> {
    const triage = await agentService.routeEmergency(request);

    const clinic = await clinicRepository.findById(triage.assigned_clinic_id);
    if (!clinic) {
      throw new DispatchError(
        `El agente asignó la clínica ${triage.assigned_clinic_id}, que no existe en el catálogo.`,
        502
      );
    }

    const origin = { latitude: request.latitude, longitude: request.longitude };
    const ambulance = fleetService.assignNearest(
      origin,
      triage.emergency_id,
      clinic,
      clinic.id
    );

    const decision: DispatchDecision = {
      emergencyId: triage.emergency_id,
      patientName: triage.patient_name,
      symptoms: request.symptoms,
      triageScore: triage.triage_score,
      severity: triage.severity,
      origin,
      clinic,
      distanceKm: triage.distance_km,
      ambulance,
      decidedAt: new Date().toISOString(),
      source: 'agent',
    };

    // Una sola publicación; los tres suscriptores reaccionan en paralelo.
    eventBus.publish(Topics.DISPATCH_DECIDED, decision);
    return decision;
  }

  /**
   * Simulacro. Recorre exactamente el mismo bus y los mismos suscriptores,
   * pero elige el hospital por cercanía sin consultar al core de Python.
   *
   * Sirve para ensayar el centro de mando cuando el motor de decisión no está
   * levantado. No calcula triaje: la severidad la indica quien lanza el
   * simulacro. Se habilita con ENABLE_DISPATCH_DRILL=true y nunca en producción.
   */
  async drill(
    request: EmergencyRequest & { severity?: Severity }
  ): Promise<DispatchDecision> {
    const clinics = await clinicRepository.findAll();
    if (clinics.length === 0) {
      throw new DispatchError('No hay clínicas registradas para el simulacro.', 503);
    }

    const origin = { latitude: request.latitude, longitude: request.longitude };
    const clinic = clinics.reduce((best, current) =>
      distanceKm(origin, current) < distanceKm(origin, best) ? current : best
    );

    const emergencyId = `drill-${Date.now().toString(36)}`;
    const ambulance = fleetService.assignNearest(origin, emergencyId, clinic, clinic.id);

    const decision: DispatchDecision = {
      emergencyId,
      patientName: request.patient_name,
      symptoms: request.symptoms,
      triageScore: 0,
      severity: request.severity ?? 'high',
      origin,
      clinic,
      distanceKm: Number(distanceKm(origin, clinic).toFixed(2)),
      ambulance,
      decidedAt: new Date().toISOString(),
      source: 'drill',
    };

    eventBus.publish(Topics.DISPATCH_DECIDED, decision);
    return decision;
  }
}

export const dispatchService = new DispatchService();
