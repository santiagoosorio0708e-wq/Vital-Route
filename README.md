<a name="readme-top"></a>

<div align="center">
  <h1>🚀 VitalRoute</h1>
  <p><strong>Agente Autónomo de Triaje y Enrutamiento Médico</strong></p>

  <p>
    <img src="https://img.shields.io/github/stars/santiagoosorio0708e-wq/Vital-Route?style=for-the-badge" alt="Stars" />
    <img src="https://img.shields.io/github/forks/santiagoosorio0708e-wq/Vital-Route?style=for-the-badge" alt="Forks" />
    <img src="https://img.shields.io/github/issues/santiagoosorio0708e-wq/Vital-Route?style=for-the-badge" alt="Issues" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python" alt="Python" />
    <img src="https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js" alt="Node" />
    <img src="https://img.shields.io/badge/MySQL-8.0+-blue?style=for-the-badge&logo=mysql" alt="MySQL" />
    <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript" alt="TS" />
  </p>
</div>

<br />

<details>
  <summary>📋 Tabla de Contenidos</summary>
  <ol>
    <li><a href="#el-problema">El problema</a></li>
    <li><a href="#qué-hace-vitalroute">Qué hace VitalRoute</a></li>
    <li><a href="#de-una-llamada-a-una-ambulancia-en-camino">De una llamada a una ambulancia en camino</a></li>
    <li><a href="#cómo-correrlo">Cómo correrlo</a></li>
    <li><a href="#construido-con">Construido con</a></li>
    <li><a href="#arquitectura-del-sistema">Arquitectura del Sistema</a></li>
    <li><a href="#prerrequisitos">Prerrequisitos</a></li>
    <li><a href="#instalación">Instalación</a></li>
    <li><a href="#el-centro-de-mando">El centro de mando</a></li>
    <li><a href="#capa-en-tiempo-real">Capa en Tiempo Real</a></li>
    <li><a href="#el-agente">El Agente</a></li>
    <li><a href="#pruebas">Pruebas</a></li>
    <li><a href="#límites-conocidos">Límites conocidos</a></li>
    <li><a href="#hoja-de-ruta">Hoja de Ruta</a></li>
    <li><a href="#contacto">Contacto</a></li>
  </ol>
</details>

<br />

## 🩺 El problema

En una ciudad como Ciudad de México, quien contesta una llamada al número de
emergencias tiene que resolver tres cosas al mismo tiempo y con la persona
todavía al teléfono: qué tan grave está el paciente, qué hospital puede
recibirlo y qué ambulancia está más cerca.

Esas tres respuestas viven en lugares distintos. La gravedad sale de los signos
vitales que alguien alcanza a dictar. La disponibilidad de camas está en el
sistema de cada hospital. La posición de las unidades, en otro tablero. Cruzar
todo eso a mano cuesta minutos, y en un paro respiratorio o un trauma grave los
minutos son el tratamiento.

El resultado conocido es que una ambulancia salga hacia un hospital que ya está
saturado, y que el traslado termine con una segunda vuelta hacia otro.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🎯 Qué hace VitalRoute

VitalRoute recibe el reporte de la emergencia escrito en lenguaje normal, como
lo dicta el operador que está atendiendo la llamada, y devuelve una decisión
completa de despacho: nivel de triaje, hospital destino, ambulancia asignada y
ruta. Todo lo que pasa después queda a la vista en un centro de mando que se
actualiza solo.

Por dentro son tres piezas que se pueden leer por separado:

*   Un **agente autónomo** con su propio ciclo de razonamiento, escrito a mano
    sin librerías de agentes. Conversa con Grok, decide qué herramienta usar y
    la ejecuta hasta cerrar la tarea.
*   Un **motor de decisión** en Python que calcula el triaje a partir de los
    signos vitales y consulta en MySQL qué hospital tiene cama disponible más
    cerca del paciente.
*   Un **gateway en tiempo real** que publica una sola decisión y deja que tres
    tableros reaccionen en paralelo: la tablet del paramédico, el hospital que
    va a recibir y el centro de mando.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 📞 De una llamada a una ambulancia en camino

**Lo que entra.** El reporte tal como se dicta, sin formato ni formulario:

```sh
cd agent
npm run dev -- "Paciente Ana Reyes, atropellada en Paseo de la Reforma. \
No responde y respira con dificultad. Pulso 138, presion 78, oxigeno 81. \
lat 19.4270 lon -99.1677"
```

**Lo que sale.** El agente lee el reporte, extrae los signos vitales, llama a
la herramienta de despacho y responde:

```text
=== Respuesta del agente ===
Paciente Ana Reyes clasificada como CRITICA (triaje 9).
Se despachó la ambulancia AMB-01 (placa CDMX-4471) al Hospital General de
México Dr. Eduardo Liceaga, a 2.3 km del lugar. El hospital ya recibió la
alerta de trauma entrante.

--- Resumen de la tarea ---
Pasos:        2
Herramientas: despachar_emergencia
Tokens:       3168 (entrada 2747, salida 421)
Costo:        USD 0.0075
Duracion:     8.9 s
```

En el mismo instante, sin recargar nada, el centro de mando dibuja la ambulancia
saliendo hacia el paciente, el hospital destino levanta su alerta de trauma
entrante con la hora estimada de llegada, y la tablet del paramédico recibe la
ruta cifrada.

El costo promedio medido es de **USD 0.0065 por tarea**. El detalle de las tres
corridas está en [`docs/reporte-tecnico-s1.md`](docs/reporte-tecnico-s1.md).

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## ⚡ Cómo correrlo

Con Docker, Node 20 y Python 3.10 instalados, son cinco pasos. El detalle de
cada uno está más abajo en [Instalación](#instalación).

```sh
# 1. Variables de entorno (incluye tu llave del panel del reto)
cp .env.example .env

# 2. Base de datos MySQL con el esquema ya cargado
docker compose up -d

# 3. Motor de decisión (Python)
cd core && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd app && uvicorn main:app --port 5000

# 4. Gateway y WebSockets (otra terminal)
cd api && npm install && npm run dev

# 5. Centro de mando (otra terminal)
cd web && npm install && npm run dev
```

El centro de mando queda en **http://localhost:5173**. Para correr el agente
contra el sistema ya levantado:

```sh
cd agent && npm install
npm run dev -- "tu reporte de emergencia aquí"
```

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🛠 Construido con

Las tecnologías clave utilizadas en este proyecto son:

*   **[Python]** - Core predictivo y algoritmos matemáticos
*   **[Node.js / TypeScript]** - API Gateway y WebSockets
*   **[MySQL]** - Base de datos principal con Triggers y Store Procedures
*   **[JavaScript / TypeScript]** - Dashboard frontend reactivo
*   **[Grok]** - Modelo de razonamiento del agente, vía el gateway del reto

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🏗 Arquitectura del Sistema

El proyecto sigue una arquitectura de Monorepo estructurada de la siguiente forma:

```text
VitalRoute/
├── core/                  # 🧠 [Dev A] Core Python, Algoritmos ETL y Triaje
│   ├── etl/               # Scripts de extracción y limpieza de datos
│   ├── model/             # Algoritmo matemático y predictivo
│   └── main.py            # Servidor RPC/HTTP interno (p. ej. FastAPI/Flask)
├── database/              # 💾 [Dev A] Scripts SQL
│   ├── init.sql           # Definición de esquemas y tablas
│   └── procedures.sql     # Triggers y procedimientos almacenados MySQL
├── api/                   # 🔌 [Dev B] Node.js API Gateway y WebSockets
│   ├── src/
│   │   ├── config/        # Carga y validación de variables de entorno
│   │   ├── controllers/   # Endpoints REST (despacho y estado de la red)
│   │   ├── events/        # Bus Pub/Sub y catálogo de tópicos
│   │   ├── services/      # Core Python, MySQL, cifrado, flota, orquestación
│   │   ├── sockets/       # Conexiones WebSocket y salas por rol
│   │   ├── subscribers/   # Paramédico, hospital y centro de mando
│   │   ├── types/         # Contratos compartidos
│   │   └── index.ts       # Punto de entrada de la API
│   └── package.json
├── web/                   # 🖥️ [Dev B] Centro de mando reactivo (Frontend)
│   ├── src/
│   │   ├── components/    # Mapa, decisión del agente, alertas, inventario
│   │   ├── hooks/         # Conexión WebSocket, estado en vivo y dictado
│   │   ├── lib/           # Tipos, geocodificación y cálculos de distancia
│   │   └── App.tsx        # Composición del tablero
│   └── package.json
├── agent/                 # 🤖 [Dev B] Agente autónomo (framework propio)
│   ├── src/
│   │   ├── core/          # El ciclo del agente, su prompt y el costo
│   │   ├── llm/           # Cliente de Grok y modelo falso para ensayos
│   │   ├── tools/         # Catálogo de herramientas
│   │   └── index.ts       # Entrada por línea de comandos
│   ├── pruebas/           # Casos de prueba del sprint y script para correrlos
│   └── package.json
└── docs/                  # 📐 Documentación de arquitectura
    ├── arquitectura-tiempo-real.md
    ├── arquitectura-agente.md
    ├── reporte-tecnico-s1.md
    └── guion-video-s1.md
```

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 📋 Prerrequisitos

*   **Docker** y **Docker Compose**
*   **Node.js** (v20 o superior)
*   **Python** (v3.10 o superior)
*   **Git**

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 💻 Instalación

1. Clona el repositorio
   ```sh
   git clone https://github.com/santiagoosorio0708e-wq/Vital-Route.git
   cd Vital-Route
   ```

2. Configura las variables de entorno
   ```sh
   cp .env.example .env
   ```
   > **Nota de Seguridad:** NUNCA escribas API Keys ni contraseñas directamente en el código base (`hardcoding`). El archivo `.env` ya se encuentra configurado en `.gitignore`. Utiliza variables de entorno para cualquier credencial externa.

   Dentro del `.env` hay dos valores que debes generar tú:

   ```sh
   # Firma de los tokens internos entre el gateway y el core
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

   # Cifrado AES-256-GCM de las coordenadas que viajan a la tablet
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   La llave del agente (`AGENT_API_KEY`) se saca del panel del reto y se pega
   en el `.env`. No se escribe en el código ni se sube al repositorio.

3. Inicia la Base de Datos
   ```sh
   docker compose up -d
   ```

4. Instala dependencias para la API y el Web
   ```sh
   cd api && npm install
   cd ../web && npm install
   ```

5. Configura el entorno Python
   ```sh
   cd ../core
   python -m venv .venv
   source .venv/bin/activate  # En Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🖥 El centro de mando

La pantalla está hecha para alguien que está atendiendo una llamada, no para
alguien que sabe leer coordenadas. En ningún momento se escribe una latitud.

*   **El lugar se dice, no se calcula.** Se escribe la dirección y aparecen
    sugerencias, se toma la ubicación del dispositivo, o se marca el punto en
    el mapa. El botón *Dictar* escribe el motivo de la llamada con la voz
    mientras el operador escucha a quien reporta.
*   **El mapa no interrumpe.** Un clic suelto no coloca nada: hay que pedir
    *Marcar en el mapa* a propósito, y el punto se puede arrastrar después para
    corregirlo. El zoom tiene sus botones abajo a la derecha, la rueda avanza
    en pasos finos y hay un botón para volver a Ciudad de México cuando uno se
    pierde.
*   **Se ve lo que decidió el agente, no solo el resultado.** El panel
    *Decisión del agente* muestra el nivel de triaje, el hospital elegido, la
    distancia, la llegada estimada y el motivo que dio el motor de decisión.
*   **La flota se lee de un vistazo.** Gris si está disponible, ámbar mientras
    va por el paciente, roja con la torreta encendida durante el traslado y
    verde al entregar. La línea llena es el tramo que está recorriendo; la
    punteada, el que falta.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## ⚡ Capa en Tiempo Real

El API Gateway mantiene una conexión TCP persistente con cada cliente, así que
el dato llega en el momento en que ocurre y no cuando el navegador se acuerda de
preguntar. Cada cliente se identifica al conectarse y entra a su sala: el
hospital que recibe al paciente ve su alerta, la ambulancia asignada ve su ruta
y solo el centro de mando ve la red completa.

Cuando el motor de decisión de la Parte 1 resuelve a qué hospital va el
paciente, el orquestador publica **una** decisión en el bus de eventos y tres
suscriptores reaccionan en paralelo y de forma independiente:

| Suscriptor         | Qué hace                                                        |
| ------------------ | --------------------------------------------------------------- |
| Paramédico         | Envía la ruta y los datos del paciente cifrados con AES-256-GCM  |
| Hospital destino   | Levanta la alerta de "Trauma Entrante" con severidad y ETA       |
| Centro de mando    | Dibuja el despacho en el mapa y refresca los tableros de stock   |

El detalle completo (salas, tópicos, seguridad, límites conocidos y catálogo de
endpoints y eventos) está en
[`docs/arquitectura-tiempo-real.md`](docs/arquitectura-tiempo-real.md).

El centro de mando lee la URL del gateway de `VITE_GATEWAY_URL`. Copia
`web/.env.example` a `web/.env.local` si cambiaste el puerto.

Para ensayar el tablero sin el core de Python, pon `ENABLE_DISPATCH_DRILL=true`
en el `.env` y usa `POST /api/v1/dispatch/drill`. El simulacro no calcula
triaje y marca la decisión con `source: "drill"`.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🤖 El Agente

El agente recibe el reporte de una emergencia escrito en lenguaje normal por un
operador telefónico y consigue que salga una ambulancia hacia el hospital
adecuado. Razona con Grok a través del gateway del reto y actúa llamando a las
herramientas del sistema.

El ciclo está escrito a mano, sin librerías de agentes: en cada vuelta le pasa
la conversación al modelo, ejecuta la herramienta que pida y le devuelve el
resultado, hasta que el modelo responde con texto. Cabe en un archivo y se
puede explicar de principio a fin.

```sh
cd agent && npm install
npm run dev -- "Paciente Ana Reyes, atropellada en Chapultepec. Pulso 138, presion 78, oxigeno 81. lat 19.4195 lon -99.1620"
```

La llave del reto se lee de `AGENT_API_KEY` en el `.env` y nunca se escribe en
el código. Para ensayar el ciclo sin gastar crédito está `AGENT_FAKE_LLM=true`,
que usa un modelo falso.

Al final de cada tarea el agente reporta los tokens y el costo en dólares. El
precio por millón de tokens sale del panel del reto y se configura en
`AGENT_PRICE_IN_USD` y `AGENT_PRICE_OUT_USD`.

Los tres casos de prueba del sprint (crítico, gravedad media y datos
incompletos) están en [`agent/pruebas/reportes.md`](agent/pruebas/reportes.md)
y se corren en fila con `./pruebas/correr.sh`.

El detalle (el ciclo, las piezas, la seguridad y qué está probado y qué no)
está en [`docs/arquitectura-agente.md`](docs/arquitectura-agente.md). El
reporte de la entrega, con decisiones, resultados y costo, está en
[`docs/reporte-tecnico-s1.md`](docs/reporte-tecnico-s1.md).

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🧪 Pruebas

Para ejecutar las pruebas en cada entorno:

*   **Core (Python)**: `pytest tests/`
*   **API (Node)**: `npm run test`
*   **Agente**: `./pruebas/correr.sh` desde `agent/`

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## ⚠️ Límites conocidos

Lo que todavía no hace, dicho de frente:

*   El triaje se calcula solo con pulso, presión y oxígeno. No considera la
    edad del paciente ni el mecanismo de la lesión.
*   La disponibilidad de camas está simulada en la base de datos; no hay
    conexión con el sistema real de ningún hospital.
*   Las distancias y los tiempos son en línea recta. No hay ruteo por calles
    ni tráfico.
*   El catálogo de hospitales es un conjunto reducido de la Ciudad de México,
    suficiente para demostrar el flujo completo.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🗺 Hoja de Ruta

- [x] Diseñar arquitectura inicial y estructura de carpetas.
- [ ] Implementar el ETL y algoritmo de triaje matemático en Python (Dev A).
- [ ] Definir esquemas MySQL, store procedures y triggers (Dev A).
- [x] Desarrollar API Gateway en Node.js y orquestación WebSocket (Dev B).
- [x] Construir dashboard de monitoreo en tiempo real (Dev B).
- [x] Integrar Core Python con API Gateway vía REST autenticado con JWT.
- [x] Agente autónomo con framework propio conectado a Grok (Dev B).
- [ ] Catálogo real de hospitales de la Ciudad de México (CLUES / DENUE).
- [ ] Ruteo por calles y tiempos con tráfico.
- [ ] Despliegue a producción.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 📧 Contacto

Equipo VitalRoute - [Enlace al Repositorio](https://github.com/santiagoosorio0708e-wq/Vital-Route)

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
