import { env } from '../config/env';
import type { TokenUsage } from '../llm/types';

export interface Costo {
  /** Dolares que costo la tarea. */
  usd: number;
  /** Si el precio esta configurado en el .env. */
  medible: boolean;
}

/**
 * Calcula lo que costo una tarea.
 *
 * Los precios del panel del reto vienen por millon de tokens, asi que se
 * divide entre un millon. Entrada y salida se cobran distinto: la salida
 * siempre es mas cara, por eso se cuentan por separado.
 */
export function calcularCosto(usage: TokenUsage): Costo {
  const medible = env.precioEntrada > 0 || env.precioSalida > 0;

  const usd =
    (usage.promptTokens / 1_000_000) * env.precioEntrada +
    (usage.completionTokens / 1_000_000) * env.precioSalida;

  return { usd, medible };
}

/** Arma la linea de costo que se imprime al final de cada tarea. */
export function describirCosto(usage: TokenUsage): string {
  const { usd, medible } = calcularCosto(usage);

  if (!medible) {
    return 'sin medir (falta AGENT_PRICE_IN_USD y AGENT_PRICE_OUT_USD en el .env)';
  }

  // Una tarea cuesta centavos, asi que seis decimales para que no salga 0.00
  return `USD ${usd.toFixed(6)}`;
}
