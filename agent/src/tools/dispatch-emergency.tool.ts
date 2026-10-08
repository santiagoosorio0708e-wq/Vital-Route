import axios from 'axios';
import { env } from '../config/env';
import type { Tool } from './registry';

/**
 * Unica herramienta del Sprint 1: despachar una emergencia.
 *
 * Llama al API Gateway de la Parte 2, que a su vez consulta al motor de
 * decision, asigna la ambulancia mas cercana y dispara los avisos en tiempo
 * real al paramedico, al hospital y al centro de mando.
 */
export const dispatchEmergencyTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'despachar_emergencia',
      description:
        'Despacha una ambulancia para una emergencia medica en Ciudad de Mexico. ' +
        'Decide el hospital destino segun la gravedad y la disponibilidad de recursos, ' +
        'asigna la unidad mas cercana y avisa al paramedico y al hospital. ' +
        'Usa esta herramienta en cuanto tengas los signos vitales y la ubicacion del paciente.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: {
            type: 'string',
            description: 'Nombre del paciente. Si no se conoce, escribe "Paciente sin identificar".',
          },
          symptoms: {
            type: 'string',
            description: 'Motivo de la llamada y sintomas, en una o dos frases.',
          },
          heart_rate: {
            type: 'number',
            description: 'Pulso en latidos por minuto.',
          },
          systolic_bp: {
            type: 'number',
            description: 'Presion arterial sistolica en mmHg.',
          },
          o2_saturation: {
            type: 'number',
            description: 'Saturacion de oxigeno en porcentaje, de 0 a 100.',
          },
          latitude: {
            type: 'number',
            description: 'Latitud del lugar de la emergencia.',
          },
          longitude: {
            type: 'number',
            description: 'Longitud del lugar de la emergencia.',
          },
        },
        required: [
          'patient_name',
          'symptoms',
          'heart_rate',
          'systolic_bp',
          'o2_saturation',
          'latitude',
          'longitude',
        ],
      },
    },
  },

  async run(args) {
    const { data } = await axios.post(
      `${env.gatewayUrl}${env.dispatchPath}`,
      {
        patient_name: args.patient_name,
        symptoms: args.symptoms,
        vitals: {
          heart_rate: args.heart_rate,
          systolic_bp: args.systolic_bp,
          o2_saturation: args.o2_saturation,
        },
        latitude: args.latitude,
        longitude: args.longitude,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 }
    );

    // Se le devuelve al modelo solo lo que necesita para redactar el resumen.
    return {
      emergencia: data.emergencyId,
      paciente: data.patientName,
      gravedad: data.severity,
      puntaje_triaje: data.triageScore,
      hospital: data.clinic?.name,
      distancia_km: data.distanceKm,
      ambulancia: `${data.ambulance?.id} (${data.ambulance?.plate})`,
      origen_decision: data.source,
    };
  },
};
