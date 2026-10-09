import mysql.connector
from mysql.connector import Error
import uuid
import os
from dotenv import load_dotenv

# Cargar variables de entorno relativas al root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

class DatabaseService:
    """
    Orquesta la comunicación hiper-transaccional entre el Agente Python y MySQL.
    Inyecta ubicaciones y consume los Stored Procedures Geoespaciales.
    """
    def __init__(self):
        self.host = os.getenv("DB_HOST", "127.0.0.1")
        self.user = os.getenv("DB_USER", "root")
        self.password = os.getenv("DB_PASSWORD", "")
        self.database = os.getenv("DB_NAME", "vitalroute")
        self.port = os.getenv("DB_PORT", "3306")

    def get_connection(self):
        return mysql.connector.connect(
            host=self.host, port=self.port, user=self.user, password=self.password, database=self.database
        )

    def route_emergency(self, payload, triage_score, severity, resource_id):
        conn = self.get_connection()
        emergency_id = str(uuid.uuid4())
        
        if not conn:
            raise Exception("Critical: Conexión a Base de Datos fallida.")

        try:
            cursor = conn.cursor(dictionary=True)
            # Todo el enrutamiento es una gran transacción ACID
            conn.autocommit = False
            
            # 1. Registrar entrada usando función geoespacial ST_GeomFromText.
            # El punto va en orden longitud-latitud, que es como lo entrega el
            # GPS. MySQL con SRID 4326 asume el orden contrario, por eso el
            # 'axis-order=long-lat'. Sin esa opción rechaza la longitud de CDMX
            # (-99) por estar fuera del rango válido de latitudes.
            insert_query = """
                INSERT INTO emergencies (id, patient_name, patient_identifier, triage_score, severity, required_resource_id, origin_location, status)
                VALUES (%s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326, 'axis-order=long-lat'), 'evaluating')
            """
            point_wkt = f"POINT({payload.longitude} {payload.latitude})"
            cursor.execute(insert_query, (emergency_id, payload.patient_name, payload.patient_identifier, triage_score, severity, resource_id, point_wkt))
            
            # 2. Ejecutar CORE PREDICTIVO en DB (Fórmula Haversine Nativa, Radio = 50km)
            cursor.callproc('find_nearest_clinics_with_availability', (payload.latitude, payload.longitude, resource_id, 50))
            
            nearest_clinic = None
            for result in cursor.stored_results():
                clinics = result.fetchall()
                if clinics:
                    nearest_clinic = clinics[0] # El SP ya ordena por distancia ASC
                    break
                    
            if not nearest_clinic:
                conn.rollback()
                return {"error": "Colapso logístico: No hay hospitales con disponibilidad de este recurso en un radio de 50km."}
                
            # 3. Asignar recurso y ejecutar Pessimistic Locking
            cursor.callproc('assign_resource_to_emergency', (emergency_id, nearest_clinic['id'], resource_id, 'autonomous_triage_agent'))
            
            # Commit masivo de la transacción
            conn.commit()
            
            return {
                "emergency_id": emergency_id,
                "clinic_id": nearest_clinic['id'],
                "clinic_name": nearest_clinic['name'],
                "distance_km": nearest_clinic['distance_km']
            }
            
        except Error as e:
            # En caso de colisión (dos agentes pidiendo el último respirador) se hace rollback total
            conn.rollback()
            raise Exception(f"Error de enrutamiento ACID: {e}")
        finally:
            if conn.is_connected():
                cursor.close()
                conn.close()
