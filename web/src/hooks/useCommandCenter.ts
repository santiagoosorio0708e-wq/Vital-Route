import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Ambulance,
  Clinic,
  ClinicInventory,
  DispatchDecision,
  LogEntry,
  TraumaAlert,
} from '../lib/types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';

const MAX_LOG_ENTRIES = 60;
const MAX_ALERTS = 8;

/**
 * Único punto de contacto con el gateway.
 *
 * Abre una conexión WebSocket, guarda la foto inicial que manda el servidor y
 * va aplicando los eventos sobre el estado de React. No hay polling: la
 * pantalla cambia cuando el servidor empuja algo.
 */
export function useCommandCenter() {
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [fleet, setFleet] = useState<Ambulance[]>([]);
  const [inventories, setInventories] = useState<ClinicInventory[]>([]);
  const [alerts, setAlerts] = useState<TraumaAlert[]>([]);
  const [dispatches, setDispatches] = useState<DispatchDecision[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pushLog = useCallback((kind: LogEntry['kind'], text: string) => {
    setLog((previous) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: new Date().toISOString(),
          kind,
          text,
        },
        ...previous,
      ].slice(0, MAX_LOG_ENTRIES)
    );
  }, []);

  useEffect(() => {
    const socket = io(GATEWAY_URL, {
      auth: { role: 'command-center' },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      pushLog('sistema', 'Centro de mando enlazado con el gateway');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      pushLog('sistema', 'Enlace perdido, reintentando conexión');
    });

    socket.on('clinics:snapshot', setClinics);
    socket.on('fleet:snapshot', setFleet);

    socket.on('inventory:snapshot', (data: ClinicInventory[]) => {
      setInventories(data.filter(Boolean));
    });

    // Una ambulancia se movió: se reemplaza solo esa unidad, no la lista entera.
    socket.on('fleet:position', (unit: Ambulance) => {
      setFleet((previous) => {
        const index = previous.findIndex((a) => a.id === unit.id);
        if (index === -1) return [...previous, unit];
        const next = [...previous];
        next[index] = unit;
        return next;
      });
    });

    socket.on('dispatch:created', (decision: DispatchDecision) => {
      setDispatches((previous) => [decision, ...previous].slice(0, 20));
      setFleet((previous) =>
        previous.map((a) => (a.id === decision.ambulance.id ? decision.ambulance : a))
      );
      pushLog(
        'despacho',
        `${decision.ambulance.id} asignada a ${decision.patientName} · destino ${decision.clinic.name}`
      );
    });

    socket.on('alert:incoming-trauma', (alert: TraumaAlert) => {
      setAlerts((previous) => [alert, ...previous].slice(0, MAX_ALERTS));
      pushLog(
        'alerta',
        `Trauma entrante en ${alert.clinicName ?? 'hospital destino'} · ETA ${alert.etaMinutes} min`
      );
    });

    socket.on('inventory:update', (inventory: ClinicInventory) => {
      setInventories((previous) => {
        const index = previous.findIndex((i) => i.clinicId === inventory.clinicId);
        if (index === -1) return [...previous, inventory];
        const next = [...previous];
        next[index] = inventory;
        return next;
      });
      pushLog('inventario', `Inventario actualizado en ${inventory.clinicName}`);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pushLog]);

  return {
    gatewayUrl: GATEWAY_URL,
    connected,
    clinics,
    fleet,
    inventories,
    alerts,
    dispatches,
    log,
    pushLog,
  };
}
