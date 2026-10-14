import { useEffect, useMemo } from 'react';
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
import type {
  Ambulance,
  Clinic,
  Coordinates,
  DispatchDecision,
  PickedPlace,
} from '../lib/types';

/** Zócalo de Ciudad de México: centro geográfico de la operación. */
const CDMX_CENTER: [number, number] = [19.4326, -99.1332];

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

/** Avisa al centro de mando cuando el operador marca un punto en el mapa. */
function ClickParaMarcar({ onPick }: { onPick: (punto: Coordinates) => void }) {
  useMapEvents({
    click: (evento) => onPick({ latitude: evento.latlng.lat, longitude: evento.latlng.lng }),
  });
  return null;
}

/** Lleva la vista al último despacho, para no perseguir la ambulancia a mano. */
function SeguirDespacho({ foco }: { foco: Coordinates | null }) {
  const mapa = useMap();

  useEffect(() => {
    if (foco) mapa.flyTo([foco.latitude, foco.longitude], 13, { duration: 1.2 });
  }, [foco, mapa]);

  return null;
}

interface Props {
  clinics: Clinic[];
  fleet: Ambulance[];
  dispatches: DispatchDecision[];
  /** Lugar que el operador está capturando ahora mismo. */
  lugar: PickedPlace | null;
  onPick: (punto: Coordinates) => void;
}

export function TacticalMap({ clinics, fleet, dispatches, lugar, onPick }: Props) {
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

  const ultimoDespacho = dispatches[0]?.origin ?? null;

  const emergenciaDe = (unidad: Ambulance) =>
    dispatches.find((despacho) => despacho.emergencyId === unidad.assignedEmergencyId);

  return (
    <MapContainer center={CDMX_CENTER} zoom={12} className="map" zoomControl={false}>
      {/* Mosaicos de OpenStreetMap, que no piden llave. Se oscurecen con CSS (ver .map-base). */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-base"
      />

      <ClickParaMarcar onPick={onPick} />
      <SeguirDespacho foco={ultimoDespacho} />

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
        >
          <Popup>{lugar.label}</Popup>
        </Marker>
      )}

      {fleet.map((unidad) => {
        const emergencia = emergenciaDe(unidad);
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
