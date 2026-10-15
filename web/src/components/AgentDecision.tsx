import { enTexto, minutosDeViaje } from '../lib/geo';
import type { DispatchDecision, Severity } from '../lib/types';

/** Cómo se lee cada severidad en la pantalla, sin tecnicismos en inglés. */
const SEVERIDAD: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Grave',
  medium: 'Moderado',
  low: 'Leve',
};

interface Props {
  decision: DispatchDecision | null;
}

/**
 * La última decisión del agente, explicada.
 *
 * El mapa muestra el resultado; esta tarjeta muestra el razonamiento: qué
 * tan grave consideró al paciente, a qué hospital lo mandó y por qué. Es la
 * diferencia entre un tablero que dibuja ambulancias y uno donde se puede
 * auditar lo que decidió el sistema.
 */
export function AgentDecision({ decision }: Props) {
  if (!decision) {
    return (
      <p className="empty">
        Aún no hay despachos. Cuando el agente resuelva una emergencia, aquí
        aparece qué decidió y con qué criterio.
      </p>
    );
  }

  const minutos = minutosDeViaje(decision.distanceKm);
  const hora = new Date(decision.decidedAt).toLocaleTimeString('es-MX');

  return (
    <article className={`decision decision--${decision.severity}`}>
      <header className="decision__head">
        <span className="decision__severity">{SEVERIDAD[decision.severity]}</span>
        <span className="data decision__score">triaje {decision.triageScore}</span>
      </header>

      <p className="decision__patient">{decision.patientName}</p>
      <p className="decision__symptoms">{decision.symptoms}</p>

      <dl className="decision__facts">
        <div>
          <dt>Hospital</dt>
          <dd>{decision.clinic.name}</dd>
        </div>
        <div>
          <dt>Distancia</dt>
          <dd className="data">{enTexto(decision.distanceKm)}</dd>
        </div>
        <div>
          <dt>Llegada estimada</dt>
          <dd className="data">{minutos} min</dd>
        </div>
        <div>
          <dt>Unidad</dt>
          <dd className="data">
            {decision.ambulance.id} · {decision.ambulance.plate}
          </dd>
        </div>
      </dl>

      {decision.message && <p className="decision__why">{decision.message}</p>}

      <footer className="decision__foot">
        <span className="data">{hora}</span>
        <span>
          {decision.source === 'agent' ? 'Motor de decisión' : 'Simulacro sin triaje'}
        </span>
      </footer>
    </article>
  );
}
