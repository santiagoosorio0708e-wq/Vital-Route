import time
import schedule
import os
import sys

# Asegurar que los módulos internos sean encontrados
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from etl.extractors import LegacySystemExtractor
from etl.transformer import MedicalDataTransformer
from etl.loader import DatabaseLoader

def etl_job():
    print("="*60)
    print("🧠 [AGENTE CDMX] Iniciando ciclo de sincronización de hospitales...")
    
    # 1. EXTRACT
    print("📡 [EXTRACT] Consultando sistemas heredados (IMSS, SSA, ISSSTE)...")
    raw_payloads = [
        LegacySystemExtractor.extract_imss_siglo_xxi(),
        LegacySystemExtractor.extract_ssa_hospital_general(),
        LegacySystemExtractor.extract_issste_juarez()
    ]
    
    # 2. TRANSFORM
    print("⚙️  [TRANSFORM] Normalizando estructuras XML, JSON y CSV a estándar VitalRoute...")
    normalized_data = MedicalDataTransformer.normalize_all(raw_payloads)
    
    # 3. LOAD
    print("💾 [LOAD] Inyectando datos en arquitectura transaccional MySQL...")
    loader = DatabaseLoader()
    loader.upsert_inventory(normalized_data)
    
    print("✅ [AGENTE CDMX] Ciclo completado.")
    print("="*60)

if __name__ == "__main__":
    print("==========================================================")
    print("🚀 VITALROUTE - WORKER ASÍNCRONO ETL (AGENTE CDMX) INICIADO")
    print("==========================================================")
    
    # Ejecutamos una vez inmediatamente
    etl_job()
    
    # Programamos la sincronización cada 1 minuto (Tiempo real para emergencias médicas)
    schedule.every(1).minutes.do(etl_job)
    
    print("⏳ Worker en ejecución constante. Presiona Ctrl+C para salir.")
    while True:
        schedule.run_pending()
        time.sleep(1)
