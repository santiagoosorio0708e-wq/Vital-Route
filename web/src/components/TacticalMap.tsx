import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ubicacionDelDispositivo } from '../lib/geocoding';
import { enTexto, kmRestantes, minutosDeViaje } from '../lib/geo';
import type {
  Ambulance,
  Clinic,
  Coordinates,
  DispatchDecision,
  PickedPlace,
} from '../lib/types';

/** Zócalo de Ciudad de México: centro geográfico de la operación. */
const CDMX_CENTER: [number, number] = [19.4326, -99.1332];
const CDMX_ZOOM = 12;

/**
 * No se puede alejar más allá del valle de México. La operación es urbana y
 * un mapa del país entero no le dice nada a nadie; antes era fácil perderse
 * con dos giros de rueda.
 */
const ZOOM_MINIMO = 9;

type CapaId = 'estandar' | 'satelite';

/**
 * Las dos vistas del mapa. Ninguna pide llave de API.
 *
 * La estándar son los mosaicos de OpenStreetMap, que vienen claros y se
 * oscurecen con un filtro de CSS para que combinen con el tablero. La de
 * satélite ya es oscura por naturaleza, así que se deja tal cual.
 */
const CAPAS: Record<
  CapaId,
  { nombre: string; url: string; atribucion: string; oscurecer: boolean }
> = {
  estandar: {
    nombre: 'Estándar',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    atribucion:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    oscurecer: true,
  },
  satelite: {
    nombre: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
    oscurecer: false,
  },
};

/**
 * Hospital: edificio con la cruz. Se dibuja en rojo cuando está saturado, para
 * que el operador vea de un vistazo a dónde no conviene mandar a nadie más.
 */
const hospitalIcon = (saturado: boolean) =>
  L.divIcon({
    className: '',
    html: `
      <span class="poi poi--hospital${saturado ? ' poi--saturated' : ''}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 21V8.5L12 3l8 5.5V21h-6v-5h-4v5H4z" fill="currentColor"/>
          <path d="M11 9h2v2h2v2h-2v2h-2v-2H9v-2h2V9z" fill="#0b1117"/>
        </svg>
      </span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

/**
 * Ambulancia vista de lado. Gris mientras espera turno; en rojo y con la torreta
 * encendida cuando va por un paciente o lo lleva al hospital.
 */
const ambulanceIcon = (unidad: Ambulance) => {
  const estado =
    unidad.status === 'available'
      ? 'libre'
      : unidad.status === 'arrived'
        ? 'llego'
        : unidad.leg === 'to_patient'
          ? 'al-paciente'
          : 'al-hospital';

  const enRuta = unidad.status === 'dispatched';

  return L.divIcon({
    className: '',
    html: `
      <span class="unit unit--${estado}">
        ${enRuta ? '<span class="unit__halo" aria-hidden="true"></span>' : ''}
        <svg class="unit__van" viewBox="0 0 38 22" aria-hidden="true">
          <rect x="1" y="5" width="20" height="11" rx="2" fill="currentColor"/>
          <path d="M21 8h6l5 4.5V16H21V8z" fill="currentColor"/>
          <path d="M23 9.5h3.4l2.8 2.5H23V9.5z" fill="#0b1117" opacity="0.55"/>
          <path d="M9.6 8h2.8v2.2h2.2v2.8h-2.2V15H9.6v-2h-2.2v-2.8h2.2V8z" fill="#f4f8fb"/>
          <circle cx="8" cy="17.5" r="3" fill="#0b1117"/>
          <circle cx="8" cy="17.5" r="1.3" fill="currentColor"/>
          <circle cx="27" cy="17.5" r="3" fill="#0b1117"/>
          <circle cx="27" cy="17.5" r="1.3" fill="currentColor"/>
        </svg>
        ${enRuta ? '<span class="unit__siren" aria-hidden="true"></span>' : ''}
      </span>`,
    iconSize: [38, 26],
    iconAnchor: [19, 16],
  });
};

/** Dónde está el paciente que espera. */
const patientIcon = (pendiente: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="poi poi--patient${pendiente ? ' poi--waiting' : ''}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7" r="3.2" fill="currentColor"/>
          <path d="M5.5 21c0-3.9 2.9-6.6 6.5-6.6s6.5 2.7 6.5 6.6H5.5z" fill="currentColor"/>
        </svg>
      </span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

/**
 * El clic en el mapa solo marca al paciente mientras el operador lo pidió.
 *
 * Antes cualquier clic suelto colocaba la emergencia, así que mover el mapa
 * era un riesgo. Ahora hay que activar el modo a propósito y se apaga solo
 * después de marcar.
 */
function ClicParaMarcar({
  activo,
  onPick,
}: {
  activo: boolean;
  onPick: (punto: Coordinates) => void;
}) {
  const mapa = useMap();

  useMapEvents({
    click: (evento) => {
      if (!activo) return;
      onPick({ latitude: evento.latlng.lat, longitude: evento.latlng.lng });
    },
  });

  // Cursor de cruz mientras el modo está encendido: el mapa avisa en qué estado está.
  useEffect(() => {
    const contenedor = mapa.getContainer();
    contenedor.classList.toggle('map--marcando', activo);
    return () => contenedor.classList.remove('map--marcando');
  }, [activo, mapa]);

  return null;
}

/**
 * Cuando entra un despacho nuevo, encuadra de un solo vistazo las tres piezas
 * que importan: la unidad, el paciente y el hospital.
 *
 * Solo se mueve con cada emergencia nueva. Mientras tanto el operador manda
 * sobre el mapa y nadie le quita el control a media maniobra.
 */
function EncuadrarDespacho({ despacho }: { despacho: DispatchDecision | null }) {
  const mapa = useMap();
  const yaEncuadrado = useRef<string | null>(null);

  useEffect(() => {
    if (!despacho || yaEncuadrado.current === despacho.emergencyId) return;
    yaEncuadrado.current = despacho.emergencyId;

    const puntos: [number, number][] = [
      [despacho.origin.latitude, despacho.origin.longitude],
      [despacho.clinic.latitude, despacho.clinic.longitude],
      [despacho.ambulance.latitude, despacho.ambulance.longitude],
    ];

    mapa.flyToBounds(L.latLngBounds(puntos).pad(0.35), {
      duration: 1.1,
      maxZoom: 15,
    });
  }, [despacho, mapa]);

  return null;
}

/**
 * Los controles que van encima del mapa: capas arriba y zoom abajo, como en
 * cualquier mapa que la gente ya sabe usar.
 *
 * Se montan dentro del contenedor de Leaflet, así que hay que cortarles los
 * eventos a mano: sin eso, un clic en el botón también llegaría al mapa.
 */
function ControlesDelMapa({
  capa,
  onCapa,
  onUbicacion,
  onError,
}: {
  capa: CapaId;
  onCapa: (capa: CapaId) => void;
  onUbicacion: (punto: Coordinates) => void;
  onError: (mensaje: string) => void;
}) {
  const mapa = useMap();
  const capas = useRef<HTMLDivElement>(null);
  const zoom = useRef<HTMLDivElement>(null);
  const [buscandome, setBuscandome] = useState(false);

  useEffect(() => {
    for (const caja of [capas.current, zoom.current]) {
      if (!caja) continue;
      L.DomEvent.disableClickPropagation(caja);
      L.DomEvent.disableScrollPropagation(caja);
    }
  }, []);

  /**
   * La rueda del ratón se mueve en cuartos de nivel para que el mapa deslice.
   * Los botones, en cambio, saltan a un nivel entero: por eso se redondea
   * antes de sumar o restar.
   */
  const acercar = () => mapa.setZoom(Math.round(mapa.getZoom()) + 1);
  const alejar = () => mapa.setZoom(Math.round(mapa.getZoom()) - 1);
  const volverACDMX = () => mapa.flyTo(CDMX_CENTER, CDMX_ZOOM, { duration: 0.9 });

  async function irAMiUbicacion() {
    setBuscandome(true);
    try {
      const punto = await ubicacionDelDispositivo();
      mapa.flyTo([punto.latitude, punto.longitude], 15, { duration: 1 });
      onUbicacion(punto);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo leer la ubicación.');
    } finally {
      setBuscandome(false);
    }
  }

  return (
    <>
      <div className="layers" ref={capas}>
        {(Object.keys(CAPAS) as CapaId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`layers__btn${capa === id ? ' layers__btn--on' : ''}`}
            onClick={() => onCapa(id)}
            aria-pressed={capa === id}
          >
            {CAPAS[id].nombre}
          </button>
        ))}
      </div>

      <div className="mapctl" ref={zoom}>
        <button type="button" className="mapctl__btn" onClick={acercar} title="Acercar">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" />
          </svg>
          <span className="sr">Acercar</span>
        </button>

        <button type="button" className="mapctl__btn" onClick={alejar} title="Alejar">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4.5 10h11" />
          </svg>
          <span className="sr">Alejar</span>
        </button>

        <button
          type="button"
          className="mapctl__btn mapctl__btn--apart"
          onClick={volverACDMX}
          title="Volver a Ciudad de México"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 3.2v2M10 14.8v2M3.2 10h2M14.8 10h2" />
            <circle cx="10" cy="10" r="4.1" />
            <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          <span className="sr">Volver a Ciudad de México</span>
        </button>

        <button
          type="button"
          className={`mapctl__btn${buscandome ? ' mapctl__btn--busy' : ''}`}
          onClick={irAMiUbicacion}
          title="Mi ubicación"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M17 3 3 9.2l6 1.8 1.8 6L17 3z" />
          </svg>
          <span className="sr">Mi ubicación</span>
        </button>
      </div>
    </>
  );
}

interface Props {
  clinics: Clinic[];
  fleet: Ambulance[];
  dispatches: DispatchDecision[];
  /** Lugar que el operador está capturando ahora mismo. */
  lugar: PickedPlace | null;
  /** Mientras está encendido, un clic en el mapa fija el lugar de la emergencia. */
  modoMarcado: boolean;
  onPick: (punto: Coordinates) => void;
  onError: (mensaje: string) => void;
}

export function TacticalMap({
  clinics,
  fleet,
  dispatches,
  lugar,
  modoMarcado,
  onPick,
  onError,
}: Props) {
  const [capa, setCapa] = useState<CapaId>('estandar');

  /**
   * El viaje se dibuja en dos tramos, como ocurre en la realidad: la unidad va
   * primero por el paciente (línea llena) y después lo traslada al hospital
   * (línea punteada, porque todavía no ha ocurrido).
   */
  const tramos = useMemo(
    () =>
      fleet
        .filter((unidad) => unidad.status === 'dispatched' && unidad.destination)
        .flatMap((unidad) => {
          const posicion: [number, number] = [unidad.latitude, unidad.longitude];
          const hospital: [number, number] = [
            unidad.destination!.latitude,
            unidad.destination!.longitude,
          ];

          if (unidad.leg === 'to_patient' && unidad.pickup) {
            const paciente: [number, number] = [
              unidad.pickup.latitude,
              unidad.pickup.longitude,
            ];
            return [
              { id: `${unidad.id}-recoge`, linea: [posicion, paciente], recorriendo: true },
              { id: `${unidad.id}-traslada`, linea: [paciente, hospital], recorriendo: false },
            ];
          }

          return [{ id: `${unidad.id}-traslada`, linea: [posicion, hospital], recorriendo: true }];
        }),
    [fleet]
  );

  /** Pacientes que todavía esperan a que llegue su unidad. */
  const esperando = useMemo(
    () =>
      fleet
        .filter((unidad) => unidad.leg === 'to_patient' && unidad.pickup)
        .map((unidad) => ({ id: unidad.id, punto: unidad.pickup! })),
    [fleet]
  );

  const emergenciaDe = (unidad: Ambulance) =>
    dispatches.find((despacho) => despacho.emergencyId === unidad.assignedEmergencyId);

  return (
    <MapContainer
      center={CDMX_CENTER}
      zoom={CDMX_ZOOM}
      minZoom={ZOOM_MINIMO}
      className="map"
      zoomControl={false}
      /*
       * Zoom en cuartos de nivel y una rueda menos nerviosa. La rueda sigue
       * funcionando igual que siempre, pero ahora desliza en vez de pegar
       * saltos de un nivel entero por cada giro.
       */
      zoomSnap={0.25}
      zoomDelta={1}
      wheelPxPerZoomLevel={160}
      wheelDebounceTime={30}
    >
      <TileLayer
        key={capa}
        attribution={CAPAS[capa].atribucion}
        url={CAPAS[capa].url}
        maxZoom={19}
        className={CAPAS[capa].oscurecer ? 'map-base' : undefined}
      />

      <ClicParaMarcar activo={modoMarcado} onPick={onPick} />
      <EncuadrarDespacho despacho={dispatches[0] ?? null} />
      <ControlesDelMapa
        capa={capa}
        onCapa={setCapa}
        onUbicacion={onPick}
        onError={onError}
      />

      {tramos.map((tramo) => (
        <Polyline
          key={tramo.id}
          positions={tramo.linea as [number, number][]}
          pathOptions={{
            color: tramo.recorriendo ? '#e5484d' : '#4dd0c7',
            weight: tramo.recorriendo ? 3 : 2,
            dashArray: tramo.recorriendo ? undefined : '6 6',
            opacity: tramo.recorriendo ? 0.9 : 0.6,
          }}
        />
      ))}

      {clinics.map((clinica) => (
        <Marker
          key={clinica.id}
          position={[clinica.latitude, clinica.longitude]}
          icon={hospitalIcon(clinica.status === 'saturated')}
        >
          <Popup>
            <strong>{clinica.name}</strong>
            <br />
            {clinica.address}
            <br />
            Capacidad {clinica.capacityLevel}
          </Popup>
        </Marker>
      ))}

      {esperando.map((paciente) => (
        <Marker
          key={`espera-${paciente.id}`}
          position={[paciente.punto.latitude, paciente.punto.longitude]}
          icon={patientIcon(true)}
        >
          <Popup>Paciente en espera · {paciente.id} en camino</Popup>
        </Marker>
      ))}

      {lugar && (
        <Marker
          position={[lugar.latitude, lugar.longitude]}
          icon={patientIcon(false)}
          draggable
          eventHandlers={{
            // Se puede corregir el punto arrastrándolo, sin volver a empezar.
            dragend: (evento) => {
              const destino = evento.target.getLatLng();
              onPick({ latitude: destino.lat, longitude: destino.lng });
            },
          }}
        >
          <Popup>
            {lugar.label}
            <br />
            <span className="popup__hint">Arrastra el punto para corregirlo</span>
          </Popup>
        </Marker>
      )}

      {fleet.map((unidad) => {
        const emergencia = emergenciaDe(unidad);
        const restante =
          unidad.status === 'dispatched'
            ? kmRestantes(
                unidad,
                unidad.leg === 'to_patient' ? unidad.pickup : null,
                unidad.destination
              )
            : null;

        return (
          <Marker
            key={unidad.id}
            position={[unidad.latitude, unidad.longitude]}
            icon={ambulanceIcon(unidad)}
          >
            <Popup>
              <strong>
                {unidad.id} · {unidad.plate}
              </strong>
              <br />
              {unidad.status === 'available' && 'Disponible en zona'}
              {unidad.status === 'dispatched' &&
                (unidad.leg === 'to_patient'
                  ? 'En camino por el paciente'
                  : 'Trasladando al hospital')}
              {unidad.status === 'arrived' && 'Entregó en el hospital'}
              {restante !== null && (
                <>
                  <br />
                  Le faltan {enTexto(restante)} · {minutosDeViaje(restante)} min
                </>
              )}
              {emergencia && (
                <>
                  <br />
                  Paciente: {emergencia.patientName}
                  <br />
                  Destino: {emergencia.clinic.name}
                </>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
