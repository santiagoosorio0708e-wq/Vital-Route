# Arquitectura de la capa en tiempo real

Este documento cubre la Parte 2 de VitalRoute: el API Gateway, el módulo de
despacho asíncrono y el centro de mando. La Parte 1 (ETL, motor de triaje y base
de datos) se documenta aparte.

## Por qué WebSockets y no HTTP por sondeo

Un tablero de despacho médico tiene que mostrar el cambio en el instante en que
ocurre. Con sondeo HTTP cada cliente preguntaría "¿hay algo nuevo?" cada pocos
segundos: la mayoría de esas peticiones vuelven vacías, y aun así cada una abre
conexión, viaja con sus cabeceras y consume un worker del servidor. Con cien
ambulancias y cincuenta hospitales preguntando cada dos segundos son 4.500
peticiones por minuto para, casi siempre, no decir nada.

Con WebSockets la conexión TCP se abre una vez y queda viva. El servidor empuja
el dato en el momento exacto en que se produce, y una conexión inactiva no
cuesta prácticamente nada. El retraso deja de depender del intervalo de sondeo.

Se usa Socket.IO sobre `ws` porque resuelve tres cosas que tendríamos que
escribir a mano: reconexión automática cuando una ambulancia pierde señal,
salas para dirigir un mensaje a un destinatario concreto, y respaldo a
*long-polling* si una red hospitalaria bloquea el protocolo WebSocket.

## Salas: cada mensaje a su destinatario

Un cliente se identifica al conectarse y entra a una sala:

| Rol              | Sala              | Qué recibe                                    |
| ---------------- | ----------------- | --------------------------------------------- |
| `command-center` | `command-center`  | Todo: flota, despachos, alertas, inventario   |
| `ambulance`      | `ambulance:<id>`  | Solo su asignación cifrada y su posición      |
| `clinic`         | `clinic:<id>`     | Solo sus alertas de trauma y su inventario    |

Esto no es una comodidad de diseño: es contención de datos clínicos. El Hospital
Juárez no tiene por qué recibir el nombre ni el diagnóstico de un paciente que
va camino al Siglo XXI.

Al entrar, cada cliente recibe una foto del estado actual (`*:snapshot`) para no
arrancar con la pantalla vacía mientras llega el primer evento.

## El bus de eventos

El orquestador no sabe quién escucha. Publica una decisión y sigue:

```
POST /api/v1/dispatch
        │
        ├─► AgentService ──► core Python (JWT) ──► clínica asignada + recurso reservado
        ├─► ClinicRepository ──► coordenadas de la clínica (MySQL, solo lectura)
        ├─► FleetService ──► ambulancia disponible más cercana
        │
        └─► eventBus.publish("dispatch.decided", decision)
                    │
      ┌─────────────┼─────────────────────────┐
      ▼             ▼                         ▼
 paramédico     hospital                centro de mando
 GPS cifrado    "Trauma entrante"       mapa + bitácora
                      │
                      └─► publish("inventory.changed") ──► tableros
```

Tres propiedades que importan en una urgencia:

- **La publicación no bloquea.** Quien reporta la emergencia recibe su respuesta
  HTTP sin esperar a que se entreguen las tres notificaciones.
- **Los suscriptores son independientes.** Si la tablet del paramédico está
  fuera de cobertura, la alerta del hospital se entrega igual.
- **Agregar destinatarios no toca el publicador.** Un SMS al familiar sería un
  archivo nuevo en `subscribers/` y una línea en `subscribers/index.ts`.

La implementación actual vive en memoria, sobre `EventEmitter`, detrás de la
interfaz `EventBus`. Para varias instancias del gateway se sustituye por Redis o
RabbitMQ sin tocar publicadores ni suscriptores.

### Tópicos

| Tópico                  | Lo publica        | Lo consume                        |
| ----------------------- | ----------------- | --------------------------------- |
| `dispatch.decided`      | DispatchService   | Paramédico, hospital, mando       |
| `fleet.ambulance.moved` | FleetService      | Mando y la propia unidad          |
| `inventory.changed`     | HospitalSubscriber| Mando y el hospital afectado      |

## Seguridad

**Token de servicio.** `core/app/security.py` solo acepta peticiones con un JWT
HS256 cuyo claim `service` sea `vitalroute_gateway`. El gateway firma el suyo con
la llave compartida del `.env`, lo guarda en caché y lo renueva un minuto antes
de que expire. El endpoint `generate-test-token` del core queda reservado para
pruebas con Postman, como dice su propio comentario.

**Coordenadas cifradas.** Lo que viaja a la tablet va dentro de un sobre
AES-256-GCM: destino, ubicación de recogida, nombre y diagnóstico del paciente.
Fuera del sobre solo queda lo mínimo para enrutar el mensaje. GCM se eligió por
ser cifrado autenticado: alterar un byte en tránsito invalida el `authTag` y la
tablet descarta el paquete en vez de conducir a la ambulancia a una dirección
falsa. Cada mensaje lleva su propio IV aleatorio.

**La llave nunca se escribe en el código.** Sale de `GPS_ENCRYPTION_KEY`, y el
`.env` está en `.gitignore`.

## Estado y límites conocidos

- **El gateway nunca escribe en MySQL.** Quien descuenta inventario es el stored
  procedure que invoca el core de Python, con bloqueo pesimista. El gateway solo
  lee para pintar el mapa y los tableros. Así no hay dos autoridades sobre el
  mismo dato.
- **La flota es simulada.** No existe tabla de ambulancias en la Parte 1. El
  gateway mantiene cinco unidades en memoria y las mueve a 45 km/h hacia el
  hospital asignado. Cuando haya GPS real, se reemplaza `FleetService` y nada
  más cambia.
- **Catálogo de respaldo.** El core responde con el id y el nombre de la clínica,
  pero no con sus coordenadas, y el mapa las necesita. Si MySQL no responde, el
  repositorio cae al catálogo semilla de `database/init.sql` y lo avisa por
  consola.
- **El bus en memoria no sobrevive a un reinicio.** Es correcto para una sola
  instancia; con varias hace falta un bus externo.

## Endpoints

| Método | Ruta                                | Para qué                                  |
| ------ | ----------------------------------- | ----------------------------------------- |
| GET    | `/health`                           | Estado y número de clientes conectados    |
| POST   | `/api/v1/dispatch`                  | Reportar una emergencia y despacharla     |
| POST   | `/api/v1/dispatch/drill`            | Simulacro sin el core (solo desarrollo)   |
| GET    | `/api/v1/network/clinics`           | Catálogo de hospitales con coordenadas    |
| GET    | `/api/v1/network/inventory`         | Inventario de toda la red                 |
| GET    | `/api/v1/network/inventory/:id`     | Inventario de un hospital                 |
| GET    | `/api/v1/network/fleet`             | Estado actual de la flota                 |

## Eventos WebSocket

Del servidor al cliente:

| Evento                   | Va a                     | Contenido                         |
| ------------------------ | ------------------------ | --------------------------------- |
| `connection:ready`       | Quien se conecta         | Rol y sala asignada               |
| `fleet:snapshot`         | Mando                    | Flota completa                    |
| `clinics:snapshot`       | Mando                    | Hospitales con coordenadas        |
| `inventory:snapshot`     | Mando y hospital         | Existencias actuales              |
| `dispatch:created`       | Mando                    | Decisión completa del despacho    |
| `dispatch:assignment`    | Ambulancia asignada      | Ruta cifrada AES-256-GCM          |
| `alert:incoming-trauma`  | Hospital destino y mando | Paciente, severidad y ETA         |
| `fleet:position`         | Mando y la unidad        | Nueva posición                    |
| `inventory:update`       | Mando y hospital         | Existencias tras la reserva       |

## El simulacro

`POST /api/v1/dispatch/drill` recorre el mismo bus y los mismos suscriptores,
pero elige hospital por cercanía sin llamar al core de Python. Existe para
ensayar el centro de mando cuando el motor de decisión no está levantado.

No calcula triaje: la severidad la indica quien lanza el simulacro, y la
decisión queda marcada con `source: "drill"` para que nunca se confunda con una
real. Viene apagado; se enciende con `ENABLE_DISPATCH_DRILL=true`.
