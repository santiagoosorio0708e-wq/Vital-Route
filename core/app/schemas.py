from pydantic import BaseModel, Field
from typing import Optional

class Vitals(BaseModel):
    heart_rate: int = Field(..., description="Latidos por minuto")
    systolic_bp: int = Field(..., description="Presión arterial sistólica")
    o2_saturation: int = Field(..., description="Saturación de oxígeno %")

class EmergencyRequest(BaseModel):
    patient_name: str
    patient_identifier: Optional[str] = None
    symptoms: str
    vitals: Vitals
    latitude: float = Field(..., description="Latitud de la emergencia (Ej. CDMX)")
    longitude: float = Field(..., description="Longitud de la emergencia")

class TriageResponse(BaseModel):
    emergency_id: str
    patient_name: str
    triage_score: float
    severity: str
    assigned_clinic_id: int
    clinic_name: str
    distance_km: float
    message: str
