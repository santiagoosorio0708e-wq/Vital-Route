import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import { dispatchService, DispatchError } from '../services/dispatch.service';
import type { EmergencyRequest } from '../types/dispatch.types';

const router = Router();

/**
 * Valida el cuerpo antes de molestar al motor de decisión.
 * Devuelve la lista de errores; vacía significa que el cuerpo es válido.
 */
function validate(body: any): string[] {
  const errors: string[] = [];

  if (!body?.patient_name?.trim()) errors.push('patient_name es obligatorio.');
  if (!body?.symptoms?.trim()) errors.push('symptoms es obligatorio.');

  const { latitude, longitude, vitals } = body ?? {};
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    errors.push('latitude debe ser un número entre -90 y 90.');
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    errors.push('longitude debe ser un número entre -180 y 180.');
  }

  if (!vitals || typeof vitals !== 'object') {
    errors.push('vitals es obligatorio.');
  } else {
    const checks: Array<[string, number, number]> = [
      ['heart_rate', 10, 300],
      ['systolic_bp', 30, 300],
      ['o2_saturation', 0, 100],
    ];
    for (const [field, min, max] of checks) {
      const value = vitals[field];
      if (typeof value !== 'number' || value < min || value > max) {
        errors.push(`vitals.${field} debe ser un número entre ${min} y ${max}.`);
      }
    }
  }

  return errors;
}

/**
 * POST /api/v1/dispatch
 * Punto de entrada de una emergencia. Consulta al agente, asigna ambulancia y
 * dispara los eventos en tiempo real.
 */
router.post('/', async (req: Request, res: Response) => {
  const errors = validate(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos de la emergencia inválidos', errors });
  }

  try {
    const decision = await dispatchService.dispatch(req.body as EmergencyRequest);
    return res.status(201).json(decision);
  } catch (error) {
    if (error instanceof DispatchError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (axios.isAxiosError(error)) {
      // El core de Python respondió con un error propio: se propaga tal cual.
      if (error.response) {
        return res.status(error.response.status).json({
          error: 'El motor de decisión rechazó la emergencia',
          detail: error.response.data,
        });
      }
      return res.status(503).json({
        error: 'El motor de decisión (core Python) no está disponible',
        detail: error.message,
      });
    }

    console.error('[dispatch] Error no controlado:', error);
    return res.status(500).json({ error: 'Falla interna del gateway' });
  }
});

/**
 * POST /api/v1/dispatch/drill
 * Simulacro para ensayar el centro de mando sin el core de Python.
 * Solo existe si ENABLE_DISPATCH_DRILL=true.
 */
router.post('/drill', async (req: Request, res: Response) => {
  if (!env.enableDispatchDrill) {
    return res.status(404).json({
      error: 'El simulacro está deshabilitado. Activa ENABLE_DISPATCH_DRILL=true en el .env.',
    });
  }

  const errors = validate(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Datos del simulacro inválidos', errors });
  }

  try {
    const decision = await dispatchService.drill(req.body);
    return res.status(201).json(decision);
  } catch (error) {
    if (error instanceof DispatchError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[drill] Error no controlado:', error);
    return res.status(500).json({ error: 'Falla interna del gateway' });
  }
});

export default router;
