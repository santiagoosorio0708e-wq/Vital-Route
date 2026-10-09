# Reporte tecnico - Sprint 1

**Proyecto:** VitalRoute, despacho de ambulancias para Ciudad de Mexico
**Entrega:** S1, agente corriendo end-to-end
**Repositorio:** https://github.com/santiagoosorio0708e-wq/Vital-Route

**Estado: el agente corre de punta a punta con Grok real.** Los numeros de
este reporte salen de la corrida del 9 de octubre de 2026.

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

**Ciclo completo con Grok real contra el gateway, en modo simulacro.** Tres
reportes distintos, escritos como los dictaria un operador telefonico:

| Caso | Pasos | Que hizo el agente |
| --- | --- | --- |
| Critico | 2 | Despacho AMB-04 al Hospital General, 1.31 km |
| Gravedad media | 2 | Despacho AMB-05 al Hospital General, 2.45 km |
| Datos incompletos | 1 | No despacho: pidio los signos vitales que faltaban |

En la terminal del gateway aparecieron, para los dos despachos, las salidas de
tiempo real: `[despacho] Ruta cifrada enviada a AMB-xx` y `[alerta] Trauma
entrante en Hospital General de Mexico`.

**El caso de datos incompletos es el resultado mas interesante.** El reporte
decia que una senora se desmayo, que respiraba con dificultad y que tenia el
oxigeno en 88, sin presion arterial y sin direccion. Grok no llamo la
herramienta. Respondio:

> "Faltan signos vitales. Necesito el pulso y la presion sistolica. No
> despacho hasta tenerlos."

El modelo falso, con ese mismo texto, invento coordenadas por defecto y
despacho una ambulancia a "Paciente sin identificar". Esa diferencia es la
prueba de que el agente esta razonando y no rellenando campos.

**Camino de error.** Con el gateway apagado, la herramienta falla con
`ECONNREFUSED`, el agente se lo cuenta al modelo y cierra reportandolo en
lugar de romperse.

**Compilacion.** TypeScript sin errores en Node 22 y Node 24.

## Que fallo o quedo a medias

**El calculo de costo estaba mal y hubo que corregirlo.** La primera version
sumaba `prompt_tokens` mas `completion_tokens`. Al ver los numeros reales no
cuadraban: el caso critico reportaba 3120 tokens totales, pero 2750 de entrada
mas 112 de salida dan 2862. Faltaban 258. Son tokens de razonamiento interno
de `grok-4.6`, que se cobran y no aparecen en `completion_tokens`. Con el
calculo viejo el costo habria salido mas barato de lo real, hasta un 35% menos
en el caso de datos incompletos. Ahora la salida se obtiene restando la
entrada del total.

**El simulacro no calcula triaje real.** En modo `drill` el puntaje sale en 0
y la gravedad queda fija en `high`, asi que el caso de gravedad media no se
distingue del critico. Con el core de Python conectado, ese puntaje lo calcula
el motor de la Parte 1.

**Bug abierto en el motor de triaje, todavia sin destapar.** En
`core/app/triage_engine.py` los casos de gravedad media y baja se asignan al
recurso 4, que no existe en el seed de `init.sql` (solo hay recursos 1 a 3).
En modo simulacro no salta, porque el triaje no se ejecuta. Saltara en cuanto
se conecte el core de Python, y el caso de prueba 2 es el que lo va a destapar.

**MySQL no conectado en la maquina de pruebas.** El gateway lo detecto y uso
el catalogo semilla de CDMX, que es el comportamiento previsto. El dato real
sale cuando se levante la base.

**El modelo falso sigue siendo util, con su limite.** Saca los numeros con
expresiones regulares, asi que sirve para comprobar la mecanica del ciclo sin
gastar credito, pero no la comprension. La diferencia quedo documentada arriba.

## Costo por tarea

El panel del reto no publica la tarifa del modelo, solo el credito gastado.
Asi que el precio se midio: se anoto el gasto, se corrieron las tres tareas y
se volvio a mirar. Subio de 0.02 a 0.04 dolares. Con 8460 tokens en total, eso
da **2.36 dolares por millon de tokens**, que es el valor configurado en
`AGENT_PRICE_IN_USD` y `AGENT_PRICE_OUT_USD`.

| Caso | Pasos | Entrada | Salida | Costo USD | Duracion |
| --- | --- | --- | --- | --- | --- |
| Critico | 2 | 2750 | 370 | 0.0074 | 7.9 s |
| Gravedad media | 2 | 2778 | 539 | 0.0078 | 9.6 s |
| Datos incompletos | 1 | 1289 | 734 | 0.0048 | 15.5 s |
| **Promedio** | | | | **0.0067** | 11.0 s |

La suma calculada por el agente da 0.0200 dolares, el mismo numero que
descontó el panel. Esa coincidencia es la que valida la medicion.

Un despacho normal toma dos vueltas del ciclo: una para que el modelo pida la
herramienta y otra para que redacte el resumen. El caso de datos incompletos
tomo una sola, porque el modelo decidio no despachar, y aun asi fue el mas
lento: 15.5 segundos, con 708 tokens de razonamiento. Decidir que no hay con
que despachar cuesta mas que despachar.

A este precio, con los 80 dolares asignados al equipo caben unas doce mil
tareas.

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

- Corregir el recurso 4 en el motor de triaje.
- Levantar MySQL y el core de Python para que el triaje sea real, y volver a
  correr los tres casos para comparar contra los numeros de arriba.
- Las dos herramientas que faltan, en el Sprint 2.
