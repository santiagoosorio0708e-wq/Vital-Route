# El agente de despacho (Sprint 1)

Este documento cubre el agente: el ciclo propio que conecta a Grok con las
herramientas del sistema. El alcance es el Sprint 1, agente corriendo de punta
a punta. Las tres herramientas, los datos reales y la prueba de carga llegan en
los sprints siguientes.

## Qué hace

Entra el reporte de una emergencia escrito por un operador telefónico, en
lenguaje normal. Sale una ambulancia en camino y un resumen para el operador:

```
"Mujer joven, paciente Ana Reyes, atropellada en Avenida Chapultepec.
 Pulso 138, presión 78, oxígeno 81. lat 19.4195 lon -99.1620"
                            │
                            ▼
   el agente le pasa el reporte a Grok junto con sus herramientas
                            │
                            ▼
   Grok entiende el texto y pide: despachar_emergencia(...)
                            │
                            ▼
   la herramienta llama al API Gateway de la Parte 2, que consulta al
   motor de triaje, asigna la ambulancia y avisa en tiempo real
                            │
                            ▼
   Grok recibe el resultado y escribe el resumen para el operador
```

## Por qué un framework propio

No se usan LangChain, LlamaIndex ni ninguna librería de agentes. El ciclo cabe
en un archivo de unas cien líneas y se puede explicar de principio a fin, que es
justo lo que se defiende frente a los jueces. Una librería de agentes añadiría
cientos de dependencias y una capa de abstracción que esconde lo único que
importa aquí: cuándo se llama al modelo y cuándo se ejecuta una herramienta.

## El ciclo

Está en `agent/src/core/agent.ts` y hace lo mismo en cada vuelta:

1. Manda la conversación al modelo, junto con la lista de herramientas.
2. Si el modelo responde con texto, la tarea terminó.
3. Si el modelo pide una herramienta, se ejecuta, el resultado se anota en la
   conversación y se vuelve al paso 1.

Hay un tope de vueltas (`AGENT_MAX_STEPS`, por defecto 5). Sin él, una
herramienta que siempre falle dejaría al agente girando y gastando crédito.

Un error de una herramienta no detiene al agente: se le devuelve al modelo como
texto para que decida qué hacer, igual que a un operador al que le rebotan una
petición.

## Las piezas

| Archivo | Para qué |
| --- | --- |
| `core/agent.ts` | El ciclo. Es el corazón del framework. |
| `core/prompt.ts` | Las instrucciones permanentes del agente. |
| `llm/types.ts` | El contrato del modelo, en formato de la API de xAI. |
| `llm/grok.client.ts` | Llama al gateway del reto. |
| `llm/fake.client.ts` | Modelo falso para ensayar sin gastar crédito. |
| `tools/registry.ts` | Catálogo de herramientas. |
| `tools/dispatch-emergency.tool.ts` | La única herramienta del Sprint 1. |
| `core/costo.ts` | Calcula lo que costó la tarea con los precios del panel. |
| `config/env.ts` | Lee el `.env` y valida lo imprescindible. |

El modelo está detrás de la interfaz `LlmClient`, así que cambiar de proveedor
o pasar al modelo falso no toca el ciclo. Las herramientas se registran en el
catálogo, así que agregar las dos que faltan en el Sprint 2 es un archivo nuevo
y una línea en `index.ts`.

## La herramienta del Sprint 1

`despachar_emergencia` recibe nombre, síntomas, los tres signos vitales y la
ubicación, y llama al API Gateway. No decide el hospital: de eso se encarga el
motor de triaje de la Parte 1. Al modelo se le devuelve solo lo que necesita
para redactar el resumen, no el objeto completo del despacho.

## Seguridad

La llave del reto sale de `AGENT_API_KEY`, nunca del código, y el `.env` está en
`.gitignore`. Si falta la llave, el agente se detiene con un mensaje claro en
lugar de intentar la llamada.

## Cómo se corre

Con el gateway de la Parte 2 levantado:

```sh
cd agent
npm install
npm run dev -- "Hombre de 54 anos, dolor en el pecho, pulso 140, presion 80, oxigeno 83, lat 19.43 lon -99.13"
```

Para ensayar sin gastar crédito del reto y sin el core de Python, con
`AGENT_FAKE_LLM=true`, `ENABLE_DISPATCH_DRILL=true` en el `.env` y
`AGENT_DISPATCH_PATH=/api/v1/dispatch/drill`.

Los tres casos de prueba del sprint están en `agent/pruebas/reportes.md` y se
corren en fila con `./pruebas/correr.sh`.

## Cuánto cuesta cada tarea

El agente suma los tokens de todas las vueltas y los multiplica por el precio
configurado en `AGENT_PRICE_IN_USD` y `AGENT_PRICE_OUT_USD` (dólares por
millón de tokens). Si quedan en cero, el agente corre igual y avisa que el
costo no se está midiendo.

Hay un detalle que cuesta dinero si se pasa por alto: `grok-4.6` razona antes
de responder, y esos tokens se cobran pero **no** aparecen en
`completion_tokens`. Se notan porque `total_tokens` es mayor que la suma de
entrada y salida. Por eso la salida se calcula restando (`total - entrada`) y
no leyendo `completion_tokens` directo. Contándolos mal, el costo sale hasta
un tercio más barato de lo real.

Una tarea de despacho toma dos vueltas del ciclo: una para que el modelo pida
la herramienta y otra para que redacte el resumen.

## Qué está probado y qué no

**Probado con Grok real:** el ciclo completo contra el gateway, con tres
reportes distintos. El formato de herramientas de la API de xAI resultó ser el
correcto, así que no hubo que tocar el cliente. En el caso de datos
incompletos el modelo se negó a despachar y pidió los signos vitales que
faltaban, en lugar de rellenar los campos. Los números están en
[`reporte-tecnico-s1.md`](reporte-tecnico-s1.md).

**Probado con el modelo falso:** lo mismo, más el camino de error cuando el
gateway no responde.

**Sin probar todavía:** el flujo con el core de Python y MySQL levantados. Lo
anterior corrió en modo simulacro, donde el puntaje de triaje no se calcula.

**Límite del modelo falso:** no entiende lenguaje, saca los números del texto
con expresiones regulares. Existe para comprobar la mecánica, no la
comprensión. Esa la pone Grok.
