export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type ClientRole = 'command-center' | 'ambulance' | 'clinic';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Signos vitales tal como los espera el core de Python. */
export interface Vitals {
  heart_rate: number;
  systolic_bp: number;
  o2_saturation: number;
}

/** Cuerpo que recibe el gateway cuando se reporta una emergencia. */
export interface EmergencyRequest extends Coordinates {
  patient_name: string;
  patient_identifier?: string;
  symptoms: string;
  vitals: Vitals;
}

/** Respuesta del motor de decisión de la Parte 1. */
export interface TriageResponse {
  emergency_id: string;
  patient_name: string;
  triage_score: number;
  severity: Severity;
  assigned_clinic_id: number;
  clinic_name: string;
  distance_km: number;
  message: string;
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
  assignedEmergencyId: string | null;
  destination: Coordinates | null;
  destinationClinicId: number | null;
  updatedAt: string;
}

/** Paquete cifrado que viaja a la tablet del paramédico. */
export interface EncryptedPayload {
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
}

/** Decisión consolidada: lo que el agente resolvió más el recurso asignado. */
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
}
