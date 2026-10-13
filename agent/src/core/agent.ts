import { env } from '../config/env';
import { SYSTEM_PROMPT } from './prompt';
import type { ChatMessage, LlmClient, TokenUsage } from '../llm/types';
import type { ToolRegistry } from '../tools/registry';

export interface AgentResult {
  answer: string;
  steps: number;
  usage: TokenUsage;
  toolsUsed: string[];
}

/**
 * El ciclo del agente, escrito a mano y sin librerias de terceros.
 *
 * En cada vuelta hace lo mismo:
 *   1. Le manda la conversacion al modelo junto con las herramientas disponibles.
 *   2. Si el modelo pide una herramienta, la ejecuta y guarda el resultado.
 *   3. Repite, hasta que el modelo responde con texto en lugar de pedir algo.
 *
 * El tope de vueltas existe para que una herramienta que siempre falle no
 * deje al agente girando y gastando credito.
 */
export class Agent {
  constructor(
    private readonly llm: LlmClient,
    private readonly tools: ToolRegistry,
    private readonly log: (linea: string) => void = console.log
  ) {}

  async run(reporte: string): Promise<AgentResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: reporte },
    ];

    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const toolsUsed: string[] = [];

    for (let paso = 1; paso <= env.maxSteps; paso++) {
      this.log(`\n--- Paso ${paso} ---`);
      this.log('Razonando con el modelo...');

      const reply = await this.llm.chat(messages, this.tools.definitions());

      usage.promptTokens += reply.usage.promptTokens;
      usage.completionTokens += reply.usage.completionTokens;
      usage.totalTokens += reply.usage.totalTokens;

      // El modelo respondio con texto: la tarea termino.
      if (reply.toolCalls.length === 0) {
        this.log('El modelo responde sin pedir herramientas. Tarea terminada.');
        return {
          answer: reply.content ?? '(el modelo no devolvio texto)',
          steps: paso,
          usage,
          toolsUsed,
        };
      }

      // El modelo pide herramientas: se anota su peticion en la conversacion.
      messages.push({
        role: 'assistant',
        content: reply.content,
        tool_calls: reply.toolCalls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: call.rawArguments },
        })),
      });

      for (const call of reply.toolCalls) {
        this.log(`Ejecutando herramienta: ${call.name}`);
        toolsUsed.push(call.name);

        const resultado = await this.ejecutar(call.name, call.rawArguments);
        this.log(`Resultado: ${resultado}`);

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: resultado,
        });
      }
    }

    // Se acabaron las vueltas sin una respuesta final.
    return {
      answer:
        `El agente alcanzo el tope de ${env.maxSteps} pasos sin cerrar la tarea. ` +
        'Revisa el reporte o el estado del gateway.',
      steps: env.maxSteps,
      usage,
      toolsUsed,
    };
  }

  /**
   * Ejecuta una herramienta y devuelve siempre un texto.
   *
   * Un error no detiene al agente: se le cuenta al modelo para que decida que
   * hacer, igual que haria un operador al que le rebotan una peticion.
   */
  private async ejecutar(nombre: string, argumentosCrudos: string): Promise<string> {
    const tool = this.tools.get(nombre);
    if (!tool) {
      return JSON.stringify({ error: `No existe la herramienta "${nombre}".` });
    }

    let argumentos: Record<string, any>;
    try {
      argumentos = JSON.parse(argumentosCrudos || '{}');
    } catch {
      return JSON.stringify({
        error: 'Los argumentos no son JSON valido. Vuelve a llamar la herramienta.',
      });
    }

    try {
      return JSON.stringify(await tool.run(argumentos));
    } catch (error: any) {
      const detalle = error?.response?.data ?? error?.message ?? 'error desconocido';
      return JSON.stringify({ error: 'La herramienta fallo', detalle });
    }
  }
}
