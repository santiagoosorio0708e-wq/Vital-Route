import { assertConfig, env } from './config/env';
import { Agent } from './core/agent';
import { FakeLlmClient } from './llm/fake.client';
import { GrokClient } from './llm/grok.client';
import { ToolRegistry } from './tools/registry';
import { dispatchEmergencyTool } from './tools/dispatch-emergency.tool';

const EJEMPLO =
  'Hombre de unos 50 anos, paciente Jorge Medina, choque de auto en Eje Central. ' +
  'Esta consciente pero confundido. Pulso 140, presion 80, oxigeno 83. ' +
  'lat 19.4284 lon -99.1276';

async function main(): Promise<void> {
  const reporte = process.argv.slice(2).join(' ').trim() || EJEMPLO;

  assertConfig();

  const llm = env.useFakeLlm ? new FakeLlmClient() : new GrokClient();
  const tools = new ToolRegistry();
  tools.register(dispatchEmergencyTool);

  console.log('=== Agente de despacho VitalRoute ===');
  console.log(`Modelo:    ${llm.name}`);
  console.log(`Gateway:   ${env.gatewayUrl}${env.dispatchPath}`);
  console.log(`Reporte:   ${reporte}`);

  const inicio = Date.now();
  const resultado = await new Agent(llm, tools).run(reporte);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log('\n=== Respuesta del agente ===');
  console.log(resultado.answer);

  console.log('\n--- Resumen de la tarea ---');
  console.log(`Pasos:        ${resultado.steps}`);
  console.log(`Herramientas: ${resultado.toolsUsed.join(', ') || 'ninguna'}`);
  console.log(`Tokens:       ${resultado.usage.totalTokens} (entrada ${resultado.usage.promptTokens}, salida ${resultado.usage.completionTokens})`);
  console.log(`Duracion:     ${segundos} s`);
}

main().catch((error) => {
  console.error('\nEl agente se detuvo:', error?.message ?? error);
  process.exit(1);
});
