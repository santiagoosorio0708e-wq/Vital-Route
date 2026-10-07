import { useCommandCenter } from './hooks/useCommandCenter';
import { TacticalMap } from './components/TacticalMap';
import { DispatchForm } from './components/DispatchForm';
import { TraumaAlerts } from './components/TraumaAlerts';
import { InventoryBoard } from './components/InventoryBoard';
import { EventLog } from './components/EventLog';

export default function App() {
  const {
    gatewayUrl,
    connected,
    clinics,
    fleet,
    inventories,
    alerts,
    dispatches,
    log,
    pushLog,
  } = useCommandCenter();

  const onRoute = fleet.filter((unit) => unit.status === 'dispatched').length;
  const available = fleet.filter((unit) => unit.status === 'available').length;

  return (
    <div className="console">
      <header className="console__bar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <h1 className="brand__name">VitalRoute</h1>
          <span className="brand__city">Centro de mando · Ciudad de México</span>
        </div>

        <dl className="readout">
          <div>
            <dt>En ruta</dt>
            <dd className="data">{onRoute}</dd>
          </div>
          <div>
            <dt>Disponibles</dt>
            <dd className="data">{available}</dd>
          </div>
          <div>
            <dt>Hospitales</dt>
            <dd className="data">{clinics.length}</dd>
          </div>
        </dl>

        <p className={`link link--${connected ? 'up' : 'down'}`}>
          <span className="link__dot" aria-hidden="true" />
          {connected ? 'Enlace en vivo' : 'Sin enlace'}
        </p>
      </header>

      <main className="console__grid">
        <aside className="rail">
          <section className="panel">
            <h2 className="panel__title">Reportar emergencia</h2>
            <DispatchForm
              gatewayUrl={gatewayUrl}
              onError={(message) => pushLog('sistema', message)}
            />
          </section>

          <section className="panel panel--grow">
            <h2 className="panel__title">Bitácora del turno</h2>
            <EventLog entries={log} />
          </section>
        </aside>

        <section className="stage">
          <TacticalMap clinics={clinics} fleet={fleet} dispatches={dispatches} />
        </section>

        <aside className="rail">
          <section className="panel">
            <h2 className="panel__title">Trauma entrante</h2>
            <TraumaAlerts alerts={alerts} />
          </section>

          <section className="panel panel--grow">
            <h2 className="panel__title">Inventario hospitalario</h2>
            <InventoryBoard inventories={inventories} />
          </section>
        </aside>
      </main>
    </div>
  );
}
