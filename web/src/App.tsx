import { useState } from 'react';
import { useCommandCenter } from './hooks/useCommandCenter';
import { TacticalMap } from './components/TacticalMap';
import { DispatchForm } from './components/DispatchForm';
import { AgentDecision } from './components/AgentDecision';
import { TraumaAlerts } from './components/TraumaAlerts';
import { InventoryBoard } from './components/InventoryBoard';
import { EventLog } from './components/EventLog';
import { describirPunto } from './lib/geocoding';
import type { Coordinates, PickedPlace } from './lib/types';

export default function App() {
  /**
   * El lugar de la emergencia es lo único que comparten el formulario y el
   * mapa: se puede escribir una dirección o marcarlo con un clic, y la otra
   * mitad de la pantalla se entera.
   */
  const [lugar, setLugar] = useState<PickedPlace | null>(null);

  /**
   * Un clic suelto en el mapa no marca nada: hay que pedirlo primero desde el
   * formulario. Así el operador puede mover y acercar el mapa con libertad sin
   * colocar una emergencia sin querer.
   */
  const [modoMarcado, setModoMarcado] = useState(false);

  /** Fija el punto y después le pone nombre, sin hacer esperar a la pantalla. */
  async function marcarEnMapa(punto: Coordinates) {
    setModoMarcado(false);
    setLugar({ ...punto, label: 'Ubicando...' });
    setLugar({ ...punto, label: await describirPunto(punto) });
  }

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
              lugar={lugar}
              onLugarChange={setLugar}
              modoMarcado={modoMarcado}
              onModoMarcado={setModoMarcado}
              onError={(message) => pushLog('sistema', message)}
            />
          </section>

          <section className="panel panel--grow">
            <h2 className="panel__title">Bitácora del turno</h2>
            <EventLog entries={log} />
          </section>
        </aside>

        <section className="stage">
          <TacticalMap
            clinics={clinics}
            fleet={fleet}
            dispatches={dispatches}
            lugar={lugar}
            modoMarcado={modoMarcado}
            onPick={marcarEnMapa}
            onError={(message) => pushLog('sistema', message)}
          />
        </section>

        <aside className="rail">
          <section className="panel">
            <h2 className="panel__title">Decisión del agente</h2>
            <AgentDecision decision={dispatches[0] ?? null} />
          </section>

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
