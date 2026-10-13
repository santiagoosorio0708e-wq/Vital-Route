import axios from 'axios';
import { env } from '../config/env';
import type {
  ChatMessage,
  LlmClient,
  LlmReply,
  ToolDefinition,
} from './types';

/**
 * Cliente del gateway del reto (espejo de la API de xAI).
 *
 * Solo hace una cosa: mandar la conversacion y devolver lo que el modelo
 * respondio, ya sea texto o una peticion de usar una herramienta.
 */
export class GrokClient implements LlmClient {
  readonly name = `${env.retoModel} (gateway del reto)`;

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmReply> {
    const { data } = await axios.post(
      `${env.retoBaseUrl}/chat/completions`,
      {
        model: env.retoModel,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${env.retoApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    );

    const choice = data?.choices?.[0]?.message ?? {};
    const usage = data?.usage ?? {};

    return {
      content: choice.content ?? null,
      toolCalls: (choice.tool_calls ?? []).map((call: any) => ({
        id: call.id,
        name: call.function?.name,
        rawArguments: call.function?.arguments ?? '{}',
      })),
      usage: {
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      },
    };
  }
}
