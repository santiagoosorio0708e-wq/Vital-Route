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
    <li><a href="#acerca-del-proyecto">Acerca del Proyecto</a></li>
    <li><a href="#construido-con">Construido con</a></li>
    <li><a href="#arquitectura-del-sistema">Arquitectura del Sistema</a></li>
    <li><a href="#prerrequisitos">Prerrequisitos</a></li>
    <li><a href="#instalación">Instalación</a></li>
    <li><a href="#uso-y-características">Uso y Características</a></li>
    <li><a href="#capa-en-tiempo-real">Capa en Tiempo Real</a></li>
    <li><a href="#el-agente">El Agente</a></li>
    <li><a href="#pruebas">Pruebas</a></li>
    <li><a href="#hoja-de-ruta">Hoja de Ruta</a></li>
    <li><a href="#contacto">Contacto</a></li>
  </ol>
</details>

<br />

## 🩺 Acerca del Proyecto

**VitalRoute** es un sistema inteligente de triaje y enrutamiento médico diseñado para evaluar rápidamente la severidad de las emergencias médicas y orquestar el flujo de datos hacia los centros de atención adecuados en tiempo real. Este proyecto actúa como un agente autónomo para optimizar la toma de decisiones clínicas.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🛠 Construido con

Las tecnologías clave utilizadas en este proyecto son:

*   **[Python]** - Core predictivo y algoritmos matemáticos
*   **[Node.js / TypeScript]** - API Gateway y WebSockets
*   **[MySQL]** - Base de datos principal con Triggers y Store Procedures
*   **[JavaScript / TypeScript]** - Dashboard frontend reactivo

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
│   │   ├── components/    # Mapa, alertas, inventario, bitácora, captura
│   │   ├── hooks/         # Conexión WebSocket y estado en vivo
│   │   ├── lib/           # Tipos del contrato con el gateway
│   │   └── App.tsx        # Composición del tablero
│   └── package.json
├── agent/                 # 🤖 [Dev B] Agente autónomo (framework propio)
│   ├── src/
│   │   ├── core/          # El ciclo del agente y su prompt
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
   cd VitalRoute
   ```

2. Configura las variables de entorno
   ```sh
   cp .env.example .env
   ```
   > **Nota de Seguridad:** NUNCA escribas API Keys ni contraseñas directamente en el código base (`hardcoding`). El archivo `.env` ya se encuentra configurado en `.gitignore`. Utiliza variables de entorno para cualquier credencial externa.

3. Inicia la Base de Datos
   ```sh
   docker-compose up -d
   ```

4. Instala dependencias para la API y el Web
   ```sh
   cd api && npm install
   cd ../web && npm install
   ```

5. Configura el entorno Python
   ```sh
   cd ../core
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🚀 Uso y Características

*   **Triaje Automatizado**: Evaluación matemática en el backend con algoritmos Python.
*   **Actualizaciones en Tiempo Real**: Notificaciones instantáneas sobre pacientes en estado crítico vía WebSockets.
*   **Dashboard Centralizado**: Centro de control visual para monitoreo general de la red médica.
*   **Triggers Base de Datos**: Automatización a nivel de base de datos para auditorías o cálculos en inserción.

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

### Levantar el entorno en tiempo real

Antes de arrancar, genera la llave de cifrado y pégala en el `.env`:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Con la base de datos y el core de Python ya corriendo, en dos terminales:

```sh
cd api && npm run dev     # gateway y WebSockets en el puerto 3000
cd web && npm run dev     # centro de mando en el puerto 5173
```

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

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 🗺 Hoja de Ruta

- [x] Diseñar arquitectura inicial y estructura de carpetas.
- [ ] Implementar el ETL y algoritmo de triaje matemático en Python (Dev A).
- [ ] Definir esquemas MySQL, store procedures y triggers (Dev A).
- [x] Desarrollar API Gateway en Node.js y orquestación WebSocket (Dev B).
- [x] Construir dashboard de monitoreo en tiempo real (Dev B).
- [x] Integrar Core Python con API Gateway vía REST autenticado con JWT.
- [ ] Despliegue a producción.

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>

## 📧 Contacto

Equipo VitalRoute - [Enlace al Repositorio](https://github.com/santiagoosorio0708e-wq/Vital-Route)

<p align="right">(<a href="#readme-top">volver al inicio</a>)</p>
