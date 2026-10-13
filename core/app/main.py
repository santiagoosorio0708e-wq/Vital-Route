import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Cargar variables de entorno antes de importar otros módulos
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

# Importaciones limpias sin hacks de sys.path (Requiere ejecutar uvicorn desde core/app o usar módulo)
from schemas import EmergencyRequest, TriageResponse
from triage_engine import TriageEngine
from database_service import DatabaseService
from security import verify_jwt_token

app = FastAPI(
    title="VitalRoute Agente Autónomo Predictivo - CDMX",
    description="Motor de decisión central. Evalúa gravedad matemática y enruta geoespacialmente ambulancias a hospitales con disponibilidad confirmada en tiempo real.",
    version="1.0.0"
)

# Permitir conexiones desde el API Gateway de Node.js (Se habilita GET para el token de pruebas)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"],
)

db_service = DatabaseService()

# INYECCIÓN DE DEPENDENCIA DE SEGURIDAD (Depends(verify_jwt_token))
@app.post("/api/v1/triage/route", response_model=TriageResponse, dependencies=[Depends(verify_jwt_token)])
async def process_emergency(request: EmergencyRequest):
    """
    [🔒 REQUIERE JWT]
    1. Recibe los signos vitales y ubicación exacta de la emergencia.
    2. El TriageEngine pondera matemáticamente la gravedad clínica.
    3. Identifica el recurso requerido (Ej. Cama UCI, Respirador).
    4. El motor espacial busca en CDMX (Fórmula de Haversine).
    5. Bloquea el recurso transaccionalmente y retorna las instrucciones.
    """
    try:
        score, severity, resource_id = TriageEngine.calculate_score(request.vitals)
        routing_result = db_service.route_emergency(request, score, severity, resource_id)
        
        if "error" in routing_result:
            raise HTTPException(status_code=404, detail=routing_result["error"])
            
        return TriageResponse(
            emergency_id=routing_result["emergency_id"],
            patient_name=request.patient_name,
            triage_score=score,
            severity=severity,
            assigned_clinic_id=routing_result["clinic_id"],
            clinic_name=routing_result["clinic_name"],
            distance_km=round(routing_result["distance_km"], 2),
            message="El Agente ha enrutado la emergencia exitosamente. Recurso médico reservado."
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falla Crítica del Sistema: {str(e)}")


# ---------------------------------------------------------
# RUTA AUXILIAR: GENERADOR DE TOKENS PARA POSTMAN
# (En producción esto lo generaría un servidor de Identidad)
# ---------------------------------------------------------
@app.get("/api/v1/auth/generate-test-token")
def generate_test_token():
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret")
    
    # Práctica moderna: usar timezone.utc en lugar de utcnow() (deprecado en Python 3.12)
    payload = {
        "service": "vitalroute_gateway",
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "type": "bearer"}
