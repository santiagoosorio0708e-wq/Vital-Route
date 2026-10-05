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
            // TODO (Dev B): Construir la petición HTTP usando axios hacia:
            // POST ${this.agentUrl}/api/v1/triage/route
            // Inyectar el jwtToken en los headers (Authorization: Bearer)
            
            throw new Error("Dev B: Función routeEmergency pendiente de implementar.");
        } catch (error) {
            console.error("Error conectando con el Agente Predictivo:", error);
            throw error;
        }
    }
}
