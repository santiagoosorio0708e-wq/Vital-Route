# Guion del video - Sprint 1

Video corto, entre tres y cinco minutos. La idea no es explicar el codigo
linea por linea, sino que se vea el salto completo: alguien describe una
emergencia con palabras y termina saliendo una ambulancia.

## Antes de grabar

- [ ] `.env` listo, con la llave real y `AGENT_FAKE_LLM=false`.
- [ ] Precios puestos en `AGENT_PRICE_IN_USD` y `AGENT_PRICE_OUT_USD`.
- [ ] Gateway probado una vez, para que `npm install` no salga en el video.
- [ ] Dos terminales lado a lado y el navegador con el centro de mando abierto.
- [ ] Letra de la terminal grande, que se lea en el celular de un juez.
- [ ] Cerrar todo lo que tenga datos personales: no se graba el `.env` abierto.

## Como dejar la pantalla

```
+---------------------------+---------------------------+
|  Terminal 1: el gateway   |  Terminal 2: el agente    |
+---------------------------+---------------------------+
|        Navegador: centro de mando en vivo             |
+-------------------------------------------------------+
```

---

## Minuto 0:00 - 0:30 · Que problema se resuelve

Hablando sobre la pantalla del centro de mando, todavia quieto.

> "Cuando alguien llama al numero de emergencias no dicta un formulario.
> Dice lo que ve, como puede. VitalRoute convierte esa frase en una
> ambulancia en camino, y esto es el agente que hace esa traduccion."

## Minuto 0:30 - 1:00 · Levantar el sistema

Terminal 1:

```sh
cd api
npm run dev
```

Se queda visible la linea `API Gateway y WebSockets escuchando en el puerto 3000`.

> "Este es el gateway de la Parte 2. Atiende al agente y avisa en tiempo
> real al paramedico, al hospital y al centro de mando."

## Minuto 1:00 - 2:15 · El caso critico

Terminal 2, pegar el comando completo:

```sh
cd agent
npm run dev -- "Mujer joven, paciente Ana Reyes, atropellada en Avenida Chapultepec. Esta inconsciente y sangra por la cabeza. Pulso 138, presion 78, oxigeno 81. lat 19.4195 lon -99.1620"
```

Mientras corre, ir narrando lo que va apareciendo:

- **`Paso 1 · Razonando con el modelo`** → "Aqui el reporte va a Grok con la
  lista de herramientas disponibles."
- **`Ejecutando herramienta: despachar_emergencia`** → "Grok entendio el texto
  y decidio por su cuenta que hay que despachar. Nadie le dijo que campos
  llenar: los saco de la frase."
- **`Resultado: ... ambulancia ... hospital ... distancia_km`** → "El gateway
  asigno la ambulancia mas cercana y el hospital."
- **Cambiar a la terminal 1** y señalar `[despacho] Ruta cifrada enviada a
  AMB-xx` y `[alerta] Trauma entrante en ...` → "La ruta al paramedico va
  cifrada, y al hospital le entro la alerta de trauma."
- **Cambiar al navegador**, mostrar el centro de mando con la ambulancia
  moviendose.
- **Volver a la terminal 2** y leer el resumen final, apuntando a
  `Tokens` y `Costo`.

## Minuto 2:15 - 3:00 · El ciclo por dentro

Abrir `agent/src/core/agent.ts` y mostrar solo el bucle.

> "El framework es propio, sin librerias de agentes. Son unas cien lineas y
> hacen lo mismo en cada vuelta: le preguntan al modelo, y si pide una
> herramienta la ejecutan y vuelven a preguntar. Si el modelo responde con
> texto, la tarea termino. Hay un tope de vueltas para que una herramienta
> rota no deje al agente girando."

Si hay tiempo, mostrar `tools/registry.ts` un par de segundos:

> "Las herramientas estan en un catalogo. Agregar las que faltan en el
> siguiente sprint es un archivo nuevo."

## Minuto 3:00 - 3:40 · Que pasa cuando algo falla

Cortar el gateway en la terminal 1 con `Ctrl+C` y correr el agente otra vez.

> "Si el gateway se cae, la herramienta falla, el agente se lo cuenta al
> modelo y el modelo lo reporta. No se queda colgado ni se rompe."

Opcional, si el tiempo alcanza: el caso de datos incompletos, para mostrar
que el modelo pide lo que falta en lugar de inventarlo.

## Minuto 3:40 - 4:00 · Cierre

> "Agente corriendo de punta a punta: entra una frase, sale una ambulancia
> asignada, un hospital avisado y un costo medido por tarea."

---

## Errores que hay que evitar

- Grabar con `npm install` corriendo. Instalar antes.
- Leer el codigo en voz alta. Se muestra, se explica que hace, se sigue.
- Dejar el `.env` visible en pantalla, aunque sea un segundo.
- Pasar de largo el centro de mando. Es lo mas vistoso que tiene el proyecto.
- Pedir disculpas por lo que falta. Lo pendiente va en el reporte tecnico,
  no en el video.
