import axios from 'axios';
import { env } from '../config/env';
import { tokenService } from './token.service';
import type { EmergencyRequest, TriageResponse } from '../types/dispatch.types';

/**
 * SERVICIO PUENTE:
 * Contrato de comunicación entre el API Gateway (Node.js) y el Agente
 * Predictivo Autónomo (Python) de la Parte 1.
 *
 * El gateway firma su propio token de servicio, así que el llamador ya no
 * tiene que conseguirlo aparte.
 */
export class AgentService {
  private readonly agentUrl: string;

  constructor(agentUrl: string = env.pythonCoreUrl) {
    this.agentUrl = agentUrl;
  }

  /**
   * Envía una emergencia al Agente IA para enrutamiento.
   * @param payload Datos de la emergencia (síntomas, vitales, GPS)
   */
  async routeEmergency(payload: EmergencyRequest): Promise<TriageResponse> {
    try {
      const { data } = await axios.post<TriageResponse>(
        `${this.agentUrl}/api/v1/triage/route`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${tokenService.getServiceToken()}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        }
      );
      return data;
    } catch (error: any) {
      console.error(
        'Error crítico conectando con el Agente Predictivo (Python):',
        error?.response?.data ?? error.message
      );
      throw error;
    }
  }
}

export const agentService = new AgentService();
