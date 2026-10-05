class TriageEngine:
    """
    Cerebro Matemático del Agente Autónomo.
    Evalúa constantes vitales para determinar gravedad y recurso necesario en milisegundos.
    """
    @staticmethod
    def calculate_score(vitals):
        """
        Retorna (score, severity, required_resource_id)
        Mapeo DB: 1=UCI, 2=Sangre O-, 3=Respirador, 4=General
        """
        score = 0
        
        # 1. Ponderación O2 (Hipoxia extrema = Respirador inmediato)
        if vitals.o2_saturation < 85:
            score += 10
        elif vitals.o2_saturation < 90:
            score += 5
        elif vitals.o2_saturation < 95:
            score += 2
            
        # 2. Presión Sistólica (Choque hemorrágico = UCI/Sangre)
        if vitals.systolic_bp < 90:
            score += 6
        elif vitals.systolic_bp > 180:
            score += 3
            
        # 3. Ritmo cardíaco (Taquicardia/Bradicardia severa)
        if vitals.heart_rate > 130 or vitals.heart_rate < 50:
            score += 4
            
        # Determinación Autónoma de Severidad y Recurso Óptimo
        if vitals.o2_saturation < 85:
            return score, 'critical', 3  # Requiere Respirador Artifial (Prioridad Máxima)
        elif score >= 10:
            return score, 'critical', 1  # Requiere UCI
        elif score >= 6:
            return score, 'high', 1      # Requiere UCI Preventiva
        elif score >= 3:
            return score, 'medium', 4    # Requiere cama general
        else:
            return score, 'low', 4       # Evaluativo
