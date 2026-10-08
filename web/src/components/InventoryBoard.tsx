import type { ClinicInventory } from '../lib/types';

interface Props {
  inventories: ClinicInventory[];
}

/** Por debajo de este porcentaje el recurso se marca como escaso. */
const SCARCE_RATIO = 0.25;

export function InventoryBoard({ inventories }: Props) {
  if (inventories.length === 0) {
    return <p className="empty">Esperando el inventario de la red hospitalaria.</p>;
  }

  return (
    <div className="stack">
      {inventories.map((inventory) => (
        <article key={inventory.clinicId} className="inventory">
          <h3 className="inventory__name">{inventory.clinicName}</h3>

          {inventory.items.length === 0 ? (
            <p className="empty">
              Sin lectura de existencias. Levanta MySQL para ver el stock real.
            </p>
          ) : (
            <ul className="inventory__items">
              {inventory.items.map((item) => {
                const ratio = item.capacity > 0 ? item.quantity / item.capacity : 0;
                const scarce = ratio <= SCARCE_RATIO;
                return (
                  <li key={item.resourceId} className="resource">
                    <div className="resource__row">
                      <span className="resource__name">{item.resourceName}</span>
                      <span className={`data${scarce ? ' data--scarce' : ''}`}>
                        {item.quantity}/{item.capacity}
                      </span>
                    </div>
                    <div className="gauge">
                      <div
                        className={`gauge__fill${scarce ? ' gauge__fill--scarce' : ''}`}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
