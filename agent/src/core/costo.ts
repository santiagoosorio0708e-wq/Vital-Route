import { env } from '../config/env';
import type { TokenUsage } from '../llm/types';

export interface Costo {
  /** Tokens que entraron al modelo. */
  entrada: number;
  /**
   * Tokens que produjo el modelo. Incluye la respuesta visible y el
   * razonamiento interno, que tambien se cobra.
   */
  salida: number;
  /** Dolares que costo la tarea. */
  usd: number;
  /** Si el precio esta configurado en el .env. */
  medible: boolean;
}

/**
 * Calcula lo que costo una tarea.
 *
 * Ojo con la salida: grok-4.6 razona antes de responder, y esos tokens de
 * razonamiento se cobran pero no aparecen en completion_tokens. Se notan
 * porque total_tokens es mayor que la suma de entrada y salida. Por eso la
 * salida se saca restando, y no leyendo completion_tokens directo: de la otra
 * forma el costo saldria mas barato de lo que realmente es.
 *
 * Los precios del panel vienen por millon de tokens, asi que se divide entre
 * un millon. Entrada y salida se cuentan por separado porque se cobran
 * distinto.
 */
export function calcularCosto(usage: TokenUsage): Costo {
  const entrada = usage.promptTokens;

  // Lo que no es entrada es salida: respuesta mas razonamiento.
  const salida = Math.max(usage.totalTokens - usage.promptTokens, usage.completionTokens);

  const medible = env.precioEntrada > 0 || env.precioSalida > 0;

  const usd =
    (entrada / 1_000_000) * env.precioEntrada + (salida / 1_000_000) * env.precioSalida;

  return { entrada, salida, usd, medible };
}

/** Arma la linea de costo que se imprime al final de cada tarea. */
export function describirCosto(usage: TokenUsage): string {
  const { entrada, salida, usd, medible } = calcularCosto(usage);

  if (!medible) {
    return 'sin medir (falta AGENT_PRICE_IN_USD y AGENT_PRICE_OUT_USD en el .env)';
  }

  // Una tarea cuesta centavos, asi que seis decimales para que no salga 0.00
  const razonamiento = salida - usage.completionTokens;
  const nota = razonamiento > 0 ? `, de los cuales ${razonamiento} de razonamiento` : '';

  return `USD ${usd.toFixed(6)} (entrada ${entrada}, salida ${salida}${nota})`;
}
