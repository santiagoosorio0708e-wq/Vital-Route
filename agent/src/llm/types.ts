/**
 * Contratos del modelo de lenguaje.
 *
 * Siguen el formato de la API de xAI (el mismo de OpenAI), que es el que
 * expone el gateway del reto. Tenerlos en una interfaz propia permite
 * cambiar de proveedor o usar un modelo falso sin tocar el ciclo del agente.
 */

export interface ToolCall {
  id: string;
  name: string;
  /** Argumentos que el modelo propone, en JSON sin interpretar. */
  rawArguments: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Solo en mensajes del asistente que piden ejecutar herramientas. */
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  /** Solo en mensajes de rol "tool": a que llamada responde. */
  tool_call_id?: string;
}

/** Descripcion de una herramienta tal como la espera el modelo. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmReply {
  content: string | null;
  toolCalls: ToolCall[];
  usage: TokenUsage;
}

/** Lo unico que el agente necesita saber del modelo. */
export interface LlmClient {
  readonly name: string;
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmReply>;
}
