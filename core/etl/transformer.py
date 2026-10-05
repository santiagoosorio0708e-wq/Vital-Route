import xml.etree.ElementTree as ET
import json
import csv
from io import StringIO

class MedicalDataTransformer:
    """
    Se encarga de normalizar los distintos formatos (XML, CSV, JSON heredado) 
    a un estándar unificado que nuestra base de datos relacional entiende.
    Mapeo de Recursos DB: 1=UCI, 2=Sangre O-, 3=Respirador
    """

    @staticmethod
    def transform_imss_xml(raw_data):
        root = ET.fromstring(raw_data)
        hospital_id = int(root.find('hospitalId').text)
        uci = int(root.find('.//uci').text)
        o_neg = int(root.find('.//o_negative').text)
        ventilators = int(root.find('.//ventilators').text)
        
        return [
            {"clinic_id": hospital_id, "resource_id": 1, "quantity": uci},
            {"clinic_id": hospital_id, "resource_id": 2, "quantity": o_neg},
            {"clinic_id": hospital_id, "resource_id": 3, "quantity": ventilators},
        ]

    @staticmethod
    def transform_ssa_json(raw_data):
        data = json.loads(raw_data)
        hospital_id = data["id_clinica_local"]
        rc = data["recursos_criticos"]
        
        return [
            {"clinic_id": hospital_id, "resource_id": 1, "quantity": rc["cama_uci_adulto_disponible"]},
            {"clinic_id": hospital_id, "resource_id": 2, "quantity": rc["bolsas_sangre_on"]},
            {"clinic_id": hospital_id, "resource_id": 3, "quantity": rc["respiradores_traslado"]},
        ]

    @staticmethod
    def transform_issste_csv(raw_data):
        reader = csv.DictReader(StringIO(raw_data))
        standard_payload = []
        
        # Diccionario de mapeo de códigos legados a IDs de nuestra BD
        resource_mapping = {
            "UCI_BED": 1,
            "O_NEG_BLOOD": 2,
            "VENTILATOR": 3
        }
        
        for row in reader:
            clinic_id = int(row['clinic_code'])
            res_id = resource_mapping.get(row['resource_code'])
            qty = int(row['available_qty'])
            if res_id:
                standard_payload.append({"clinic_id": clinic_id, "resource_id": res_id, "quantity": qty})
                
        return standard_payload

    @classmethod
    def normalize_all(cls, extracted_payloads):
        normalized_data = []
        for payload in extracted_payloads:
            if payload["source"] == "IMSS_XML":
                normalized_data.extend(cls.transform_imss_xml(payload["data"]))
            elif payload["source"] == "SSA_JSON":
                normalized_data.extend(cls.transform_ssa_json(payload["data"]))
            elif payload["source"] == "ISSSTE_CSV":
                normalized_data.extend(cls.transform_issste_csv(payload["data"]))
        return normalized_data
