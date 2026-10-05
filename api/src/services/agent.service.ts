import axios from 'axios';

/**
 * SERVICIO PUENTE:
 * Esta clase sirve como contrato de comunicación entre el API Gateway (Node.js) 
 * y nuestro Agente Predictivo Autónomo (Python).
 */
export class AgentService {
    private readonly agentUrl: string;

    constructor() {
        this.agentUrl = process.env.PYTHON_CORE_URL || 'http://127.0.0.1:5000';
    }

    /**
     * Envía una emergencia al Agente IA para enrutamiento.
     * @param payload Datos de la emergencia (Sintomas, Vitales, GPS)
     * @param jwtToken Token Bearer para autorizarse en el backend Python
     */
    async routeEmergency(payload: any, jwtToken: string) {
        try {
            // Implementación completa de la petición HTTP hacia el motor Python
            const response = await axios.post(
                `${this.agentUrl}/api/v1/triage/route`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${jwtToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error(
                "Error crítico conectando con el Agente Predictivo (Python):", 
                error?.response?.data || error.message
            );
            throw error;
        }
    }
}
