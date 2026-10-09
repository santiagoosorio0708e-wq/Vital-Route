import path from 'path';
import dotenv from 'dotenv';

// El .env vive en la raiz del monorepo, una carpeta arriba de /agent.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

export const env = {
  /** Gateway del reto. Es un espejo de la API de xAI, con el mismo formato. */
  retoBaseUrl: process.env.RETO_BASE_URL ?? 'https://api.reto.pltk.mx/v1',
  retoApiKey: process.env.AGENT_API_KEY ?? '',
  retoModel: process.env.RETO_MODEL ?? 'grok-4.6',

  /** API Gateway de la Parte 2, donde viven las herramientas del agente. */
  gatewayUrl: process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000',

  /**
   * Ruta de despacho. En un ensayo sin el core de Python se apunta al
   * simulacro: /api/v1/dispatch/drill
   */
  dispatchPath: process.env.AGENT_DISPATCH_PATH ?? '/api/v1/dispatch',

  /** Tope de vueltas del ciclo. Evita que el agente se quede dando vueltas. */
  maxSteps: Number(process.env.AGENT_MAX_STEPS ?? 5),

  /**
   * Precio del modelo en dolares por cada millon de tokens. Sale del panel
   * del reto. Si queda en cero, el agente igual corre pero no reporta costo.
   */
  precioEntrada: Number(process.env.AGENT_PRICE_IN_USD ?? 0),
  precioSalida: Number(process.env.AGENT_PRICE_OUT_USD ?? 0),

  /**
   * Usa un modelo falso en lugar de Grok. Sirve para probar el ciclo completo
   * sin gastar credito del reto.
   */
  useFakeLlm: process.env.AGENT_FAKE_LLM === 'true',
};

/** Revisa que esten las variables necesarias antes de arrancar. */
export function assertConfig(): void {
  if (!env.useFakeLlm && !env.retoApiKey) {
    throw new Error(
      'Falta AGENT_API_KEY en el .env. Para probar sin el modelo real, ' +
        'usa AGENT_FAKE_LLM=true.'
    );
  }
}
