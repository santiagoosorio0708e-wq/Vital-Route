import { EventEmitter } from 'events';
import type { TopicName, TopicPayloads } from './topics';

export type Subscriber<T extends TopicName> = (
  payload: TopicPayloads[T]
) => void | Promise<void>;

/**
 * Contrato del bus. El resto del sistema solo conoce esta interfaz, así que
 * cambiar la implementación en memoria por Redis o RabbitMQ no obliga a tocar
 * los publicadores ni los suscriptores.
 */
export interface EventBus {
  publish<T extends TopicName>(topic: T, payload: TopicPayloads[T]): void;
  subscribe<T extends TopicName>(topic: T, subscriber: Subscriber<T>): void;
}

/**
 * Implementación en memoria sobre EventEmitter.
 *
 * Dos propiedades importantes para el despacho médico:
 *  - La publicación no bloquea: quien publica no espera a los suscriptores.
 *  - Los suscriptores son independientes: si la tablet del paramédico falla,
 *    la alerta del hospital se entrega igual.
 */
export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Un despacho crítico puede tener varios tableros escuchando a la vez.
    this.emitter.setMaxListeners(50);
  }

  publish<T extends TopicName>(topic: T, payload: TopicPayloads[T]): void {
    // setImmediate libera el hilo de la petición HTTP antes de notificar.
    setImmediate(() => this.emitter.emit(topic, payload));
  }

  subscribe<T extends TopicName>(topic: T, subscriber: Subscriber<T>): void {
    this.emitter.on(topic, (payload: TopicPayloads[T]) => {
      Promise.resolve()
        .then(() => subscriber(payload))
        .catch((error) => {
          // Un suscriptor caído nunca debe tumbar al resto ni al proceso.
          console.error(`[bus] Fallo en un suscriptor de "${topic}":`, error);
        });
    });
  }
}

export const eventBus: EventBus = new InMemoryEventBus();
