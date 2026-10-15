export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Clinic extends Coordinates {
  id: number;
  name: string;
  address: string | null;
  capacityLevel: string | null;
  status: string | null;
}

export interface InventoryItem {
  resourceId: number;
  resourceName: string;
  quantity: number;
  capacity: number;
}

export interface ClinicInventory {
  clinicId: number;
  clinicName: string;
  items: InventoryItem[];
  updatedAt: string;
}

export interface Ambulance extends Coordinates {
  id: string;
  plate: string;
  status: 'available' | 'dispatched' | 'arrived';
  /** Tramo del viaje: primero va por el paciente, despues lo traslada. */
  leg: 'to_patient' | 'to_hospital' | null;
  /** Donde esta el paciente. Null mientras la unidad esta libre. */
  pickup: Coordinates | null;
  assignedEmergencyId: string | null;
  destination: Coordinates | null;
  destinationClinicId: number | null;
  updatedAt: string;
}

/** Un lugar elegido por el operador, con el nombre que se le muestra. */
export interface PickedPlace extends Coordinates {
  label: string;
}

export interface DispatchDecision {
  emergencyId: string;
  patientName: string;
  symptoms: string;
  triageScore: number;
  severity: Severity;
  origin: Coordinates;
  clinic: Clinic;
  distanceKm: number;
  ambulance: Ambulance;
  decidedAt: string;
  source: 'agent' | 'drill';
  /**
   * El motivo que dio el motor de decision, en sus palabras. Es opcional
   * porque un gateway anterior a este cambio no lo manda.
   */
  message?: string;
}

export interface TraumaAlert {
  type: 'TRAUMA_ENTRANTE';
  emergencyId: string;
  severity: Severity;
  triageScore: number;
  patientName: string;
  symptoms: string;
  ambulanceId: string;
  ambulancePlate: string;
  distanceKm: number;
  etaMinutes: number;
  raisedAt: string;
  clinicId?: number;
  clinicName?: string;
}

export interface LogEntry {
  id: string;
  at: string;
  kind: 'despacho' | 'alerta' | 'inventario' | 'sistema';
  text: string;
}
