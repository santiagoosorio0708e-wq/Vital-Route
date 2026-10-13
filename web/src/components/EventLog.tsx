import type { LogEntry } from '../lib/types';

interface Props {
  entries: LogEntry[];
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function EventLog({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="empty">La bitácora se llena con cada evento del turno.</p>;
  }

  return (
    <ol className="log">
      {entries.map((entry) => (
        <li key={entry.id} className={`log__item log__item--${entry.kind}`}>
          <span className="data log__time">{time(entry.at)}</span>
          <span className="log__text">{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}
