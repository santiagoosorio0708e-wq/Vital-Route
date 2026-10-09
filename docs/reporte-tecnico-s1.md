# Reporte tecnico - Sprint 1

**Proyecto:** VitalRoute, despacho de ambulancias para Ciudad de Mexico
**Entrega:** S1, agente corriendo end-to-end
**Repositorio:** https://github.com/santiagoosorio0708e-wq/Vital-Route

> Hay valores marcados como PENDIENTE. Son los que salen de la corrida con
> Grok real, que todavia no se ha hecho porque la llave la administra el otro
> integrante del equipo. Se llenan antes de enviar el formulario.

## El problema

Cuando entra una llamada de emergencia, un operador escucha a alguien
nervioso describiendo lo que ve. No dicta campos de formulario: dice "se cayo
en la escalera del metro y no se puede levantar, respira raro". Alguien tiene
que convertir eso en una decision: que tan grave es, que ambulancia va, a que
hospital, por que ruta.

El Sprint 1 cubre ese salto completo, de la frase a la ambulancia en camino.

## Que se construyo

Un agente que recibe el reporte en lenguaje normal, lo entiende con un modelo
de lenguaje y ejecuta el despacho llamando a las herramientas del sistema.

```
reporte hablado por el operador
          |
          v
    agente (ciclo propio)  <---->  Grok, por el gateway del reto
          |
          v
    herramienta despachar_emergencia
          |
          v
    API Gateway  -->  motor de triaje (Python)
          |
          +--> ruta cifrada a la tablet del paramedico
          +--> alerta de trauma entrante al hospital
          +--> actualizacion al centro de mando
```

## El ciclo, que es el corazon del asunto

Esta en `agent/src/core/agent.ts` y cabe en unas cien lineas. En cada vuelta
hace tres cosas:

1. Manda la conversacion al modelo, junto con la lista de herramientas.
2. Si el modelo responde con texto, la tarea termino.
3. Si pide una herramienta, se ejecuta, el resultado se anota en la
   conversacion y se vuelve al paso 1.

Hay un tope de vueltas (`AGENT_MAX_STEPS`, por defecto 5). Sin el, una
herramienta que siempre falle dejaria al agente girando y gastando credito.

Un error de herramienta no detiene al agente: se le devuelve al modelo como
texto, para que decida que hacer. Es el mismo trato que recibe un operador al
que le rebotan una peticion.

## Decisiones y por que

**Framework propio, sin LangChain ni similares.** Una libreria de agentes
habria traido cientos de dependencias y una capa de abstraccion encima de lo
unico que importa: cuando se llama al modelo y cuando se ejecuta una
herramienta. Escrito a mano, el ciclo se lee de principio a fin y se puede
defender frente a un juez linea por linea.

**El modelo detras de una interfaz.** `LlmClient` tiene dos implementaciones:
`GrokClient`, que llama al gateway del reto, y `FakeLlmClient`, un modelo
falso que saca los numeros del texto con expresiones regulares. Cambiar de uno
a otro es una variable de entorno, y el ciclo no se entera. Eso permitio
probar toda la mecanica sin gastar un solo token.

**Una sola herramienta en este sprint.** `despachar_emergencia` recibe nombre,
sintomas, los tres signos vitales y la ubicacion. No decide el hospital: de eso
se encarga el motor de triaje. Las herramientas se registran en un catalogo,
asi que agregar las que faltan es un archivo nuevo y una linea en `index.ts`.

**La llave nunca toca el codigo.** Sale de `AGENT_API_KEY` en el `.env`, que
esta en `.gitignore`. Si falta, el agente se detiene con un mensaje claro en
lugar de intentar la llamada.

## Que se probo

**Ciclo completo con modelo falso contra el gateway, en modo simulacro.**
Tres reportes distintos (critico, gravedad media, datos incompletos). Los tres
despacharon, cada uno con una ambulancia distinta:

| Caso | Ambulancia | Hospital | Distancia |
| --- | --- | --- | --- |
| Critico | AMB-01 (CDMX-4471) | Hospital General de Mexico | 1.31 km |
| Gravedad media | AMB-05 (CDMX-2748) | Hospital General de Mexico | 2.45 km |
| Datos incompletos | AMB-04 (CDMX-6032) | Hospital General de Mexico | 2.93 km |

En la terminal del gateway aparecieron, para cada caso, las dos salidas de
tiempo real: `[despacho] Ruta cifrada enviada a AMB-xx` y `[alerta] Trauma
entrante en Hospital General de Mexico`.

**Camino de error.** Con el gateway apagado, la herramienta falla con
`ECONNREFUSED`, el agente se lo cuenta al modelo y cierra con "El despacho no
se pudo completar" en lugar de romperse.

**Compilacion.** TypeScript sin errores en Node 22 y Node 24.

## Que fallo o quedo a medias

**La llamada real a Grok no se ha probado.** Es lo pendiente mas importante.
El formato de herramientas que usa el cliente es el de la API de xAI, que es
lo que documenta el panel del reto, pero es una suposicion hasta que la
primera llamada real la confirme. Si el formato difiere, el ajuste cae en un
solo archivo, `agent/src/llm/grok.client.ts`.

**El modelo falso no entiende lenguaje.** Saca los numeros con expresiones
regulares, y se nota: en el caso de datos incompletos invento coordenadas por
defecto y registro al paciente como "sin identificar", en lugar de preguntar.
Esa diferencia es exactamente la que debe cubrir Grok, y es la prueba de que
el modelo falso sirve para la mecanica y no para la comprension.

**El simulacro no calcula triaje real.** En modo `drill` el puntaje sale en 0
y la gravedad queda fija en `high`. Con el core de Python conectado, ese
puntaje lo calcula el motor de la Parte 1.

**Bug abierto en el motor de triaje.** En `core/app/triage_engine.py` los
casos de gravedad media y baja se asignan al recurso 4, que no existe en el
seed de `init.sql` (solo hay recursos 1 a 3). Esos casos fallan con error de
llave foranea. Los criticos y altos funcionan. Queda corregido antes del
cierre del sprint.

**MySQL no conectado en la maquina de pruebas.** El gateway lo detecto y uso
el catalogo semilla de CDMX, que es el comportamiento previsto. El dato real
sale cuando se levante la base.

## Costo por tarea

El agente reporta los tokens de entrada y salida al final de cada corrida y
calcula el costo con los precios de `AGENT_PRICE_IN_USD` y
`AGENT_PRICE_OUT_USD`, que se toman del panel del reto.

| Caso | Pasos | Tokens entrada | Tokens salida | Costo USD |
| --- | --- | --- | --- | --- |
| Critico | 2 | PENDIENTE | PENDIENTE | PENDIENTE |
| Gravedad media | 2 | PENDIENTE | PENDIENTE | PENDIENTE |
| Datos incompletos | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

Con el modelo falso los tokens son cero, asi que la tabla solo se llena con la
corrida real. Cada tarea toma dos vueltas del ciclo: una para que el modelo
pida la herramienta y otra para que redacte el resumen.

## Como se corre

```sh
# terminal 1
cd api && npm install && npm run dev

# terminal 2
cd agent && npm install
npm run dev -- "Mujer joven, paciente Ana Reyes, atropellada en Avenida Chapultepec. Pulso 138, presion 78, oxigeno 81. lat 19.4195 lon -99.1620"
```

Para ensayar sin gastar credito y sin el core de Python, en el `.env`:
`AGENT_FAKE_LLM=true`, `ENABLE_DISPATCH_DRILL=true` y
`AGENT_DISPATCH_PATH=/api/v1/dispatch/drill`.

Los tres casos de prueba estan en `agent/pruebas/reportes.md` y se corren en
fila con `./pruebas/correr.sh`.

## Lo que sigue

- Primera llamada real a Grok y llenado de la tabla de costo.
- Corregir el recurso 4 en el motor de triaje.
- Levantar MySQL y el core de Python para que el triaje sea real.
- Las dos herramientas que faltan, en el Sprint 2.
