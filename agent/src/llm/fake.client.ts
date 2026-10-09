import type {
  ChatMessage,
  LlmClient,
  LlmReply,
  ToolDefinition,
} from './types';

/**
 * Modelo falso para ensayar el ciclo sin gastar credito del reto.
 *
 * No entiende lenguaje: saca los numeros del texto con expresiones regulares.
 * Sirve para comprobar que el ciclo, las herramientas y el gateway funcionan
 * de punta a punta. La comprension real la pone Grok.
 */
export class FakeLlmClient implements LlmClient {
  readonly name = 'modelo falso (ensayo sin credito)';

  async chat(messages: ChatMessage[], _tools: ToolDefinition[]): Promise<LlmReply> {
    const yaDespacho = messages.some((message) => message.role === 'tool');

    // Segunda vuelta: ya hay resultado de la herramienta, se cierra con un resumen.
    if (yaDespacho) {
      const resultado = [...messages].reverse().find((m) => m.role === 'tool');
      const fallo = (resultado?.content ?? '').includes('"error"');
      return {
        content: fallo
          ? `El despacho no se pudo completar. Detalle: ${resultado?.content}`
          : `Despacho confirmado. Respuesta de la herramienta: ${resultado?.content}`,
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // Primera vuelta: se arma la llamada a la herramienta con lo que diga el texto.
    const texto = messages.find((m) => m.role === 'user')?.content ?? '';
    const numero = (patrones: RegExp[], porDefecto: number): number => {
      for (const patron of patrones) {
        const encontrado = texto.match(patron);
        if (encontrado) return Number(encontrado[1]);
      }
      return porDefecto;
    };

    const argumentos = {
      patient_name: texto.match(/paciente\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,40})/i)?.[1]?.trim()
        ?? 'Paciente sin identificar',
      symptoms: texto.slice(0, 200),
      heart_rate: numero([/pulso\D{0,10}(\d{2,3})/i, /frecuencia\D{0,10}(\d{2,3})/i], 120),
      systolic_bp: numero([/presi[oó]n\D{0,10}(\d{2,3})/i, /sist[oó]lica\D{0,10}(\d{2,3})/i], 90),
      o2_saturation: numero([/ox[ií]geno\D{0,10}(\d{2,3})/i, /saturaci[oó]n\D{0,10}(\d{2,3})/i], 90),
      // [^\d-] y no \D: \D se comeria el signo menos y la longitud de CDMX,
      // que es negativa, terminaria del otro lado del mundo.
      latitude: Number(texto.match(/lat[^\d-]{0,10}(-?\d+\.\d+)/i)?.[1] ?? 19.4326),
      longitude: Number(texto.match(/lon[^\d-]{0,10}(-?\d+\.\d+)/i)?.[1] ?? -99.1332),
    };

    return {
      content: null,
      toolCalls: [
        {
          id: 'llamada-falsa-1',
          name: 'despachar_emergencia',
          rawArguments: JSON.stringify(argumentos),
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}
