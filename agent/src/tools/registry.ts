import type { ToolDefinition } from '../llm/types';

/**
 * Una herramienta es una funcion que el modelo puede pedir que se ejecute.
 *
 * `definition` es lo que ve el modelo; `run` es lo que corre de verdad.
 */
export interface Tool {
  definition: ToolDefinition;
  run(args: Record<string, any>): Promise<unknown>;
}

/** Catalogo de herramientas disponibles para el agente. */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.function.name, tool);
  }

  /** Lo que se le manda al modelo en cada peticion. */
  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}
