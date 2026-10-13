import type { TraumaAlert } from '../lib/types';

const severityLabel: Record<TraumaAlert['severity'], string> = {
  critical: 'Crítico',
  high: 'Grave',
  medium: 'Moderado',
  low: 'Leve',
};

interface Props {
  alerts: TraumaAlert[];
}

export function TraumaAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <p className="empty">
        Ningún hospital tiene traslados en camino. Las alertas aparecen aquí en
        cuanto el agente asigna un destino.
      </p>
    );
  }

  return (
    <ul className="alerts">
      {alerts.map((alert) => (
        <li key={alert.emergencyId} className={`alert alert--${alert.severity}`}>
          <div className="alert__head">
            <span className="alert__severity">{severityLabel[alert.severity]}</span>
            <span className="data">ETA {alert.etaMinutes} min</span>
          </div>
          <p className="alert__clinic">{alert.clinicName ?? 'Hospital destino'}</p>
          <p className="alert__patient">{alert.patientName}</p>
          <p className="alert__symptoms">{alert.symptoms}</p>
          <p className="data alert__unit">
            {alert.ambulanceId} · {alert.ambulancePlate} · {alert.distanceKm.toFixed(1)} km
          </p>
        </li>
      ))}
    </ul>
  );
}
