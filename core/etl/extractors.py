import json
import xml.etree.ElementTree as ET
import random
import csv
from io import StringIO

class LegacySystemExtractor:
    """
    Simula la extracción de inventarios médicos de sistemas hospitalarios heredados (Legacy).
    En el escenario real CDMX, esto se conectaría vía SOAP, VPN o SFTP a los servidores de cada entidad.
    """
    
    @staticmethod
    def extract_imss_siglo_xxi():
        """Simula respuesta XML del Centro Médico Nacional Siglo XXI (IMSS)"""
        xml_data = f"""<?xml version="1.0" encoding="UTF-8"?>
        <hospitalData>
            <hospitalId>2</hospitalId>
            <beds>
                <uci>{random.randint(0, 10)}</uci>
                <general>50</general>
            </beds>
            <bloodBank>
                <o_negative>{random.randint(5, 20)}</o_negative>
            </bloodBank>
            <equipment>
                <ventilators>{random.randint(0, 5)}</ventilators>
            </equipment>
        </hospitalData>
        """
        return {"source": "IMSS_XML", "data": xml_data}

    @staticmethod
    def extract_ssa_hospital_general():
        """Simula respuesta JSON cruda del Hospital General de México (SSA)"""
        json_data = {
            "institucion": "SSA",
            "id_clinica_local": 1,
            "recursos_criticos": {
                "cama_uci_adulto_disponible": random.randint(0, 15),
                "bolsas_sangre_on": random.randint(10, 30),
                "respiradores_traslado": random.randint(2, 10)
            }
        }
        return {"source": "SSA_JSON", "data": json.dumps(json_data)}

    @staticmethod
    def extract_issste_juarez():
        """Simula volcado CSV del Hospital Juárez de México (ISSSTE)"""
        csv_data = f"clinic_code,resource_code,available_qty\n3,UCI_BED,{random.randint(0, 5)}\n3,O_NEG_BLOOD,{random.randint(5, 15)}\n3,VENTILATOR,{random.randint(1, 4)}"
        return {"source": "ISSSTE_CSV", "data": csv_data}
