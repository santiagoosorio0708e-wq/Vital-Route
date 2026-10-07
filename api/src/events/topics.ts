import type {
  Ambulance,
  ClinicInventory,
  DispatchDecision,
} from '../types/dispatch.types';

/**
 * Catálogo único de tópicos del bus. Tenerlos centralizados evita que un
 * publicador y un suscriptor se desincronicen por una cadena mal escrita.
 */
export const Topics = {
  DISPATCH_DECIDED: 'dispatch.decided',
  AMBULANCE_MOVED: 'fleet.ambulance.moved',
  INVENTORY_CHANGED: 'inventory.changed',
} as const;

/** Mapa tópico -> forma del mensaje. Lo usa el bus para tipar publish/subscribe. */
export interface TopicPayloads {
  [Topics.DISPATCH_DECIDED]: DispatchDecision;
  [Topics.AMBULANCE_MOVED]: Ambulance;
  [Topics.INVENTORY_CHANGED]: ClinicInventory;
}

export type TopicName = keyof TopicPayloads;
