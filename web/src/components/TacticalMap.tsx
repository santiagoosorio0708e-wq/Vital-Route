import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Ambulance, Clinic, DispatchDecision } from '../lib/types';

/** Zócalo de Ciudad de México: centro geográfico de la operación. */
const CDMX_CENTER: [number, number] = [19.4326, -99.1332];

const hospitalIcon = (saturated: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="pin pin--hospital${saturated ? ' pin--saturated' : ''}">H</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const ambulanceIcon = (status: Ambulance['status']) =>
  L.divIcon({
    className: '',
    html: `<span class="pin pin--unit pin--${status}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

interface Props {
  clinics: Clinic[];
  fleet: Ambulance[];
  dispatches: DispatchDecision[];
}

export function TacticalMap({ clinics, fleet, dispatches }: Props) {
  /** Trazos activos: de la ambulancia en ruta hacia su hospital destino. */
  const routes = useMemo(
    () =>
      fleet
        .filter((unit) => unit.status === 'dispatched' && unit.destination)
        .map((unit) => ({
          id: unit.id,
          line: [
            [unit.latitude, unit.longitude],
            [unit.destination!.latitude, unit.destination!.longitude],
          ] as [number, number][],
        })),
    [fleet]
  );

  const emergencyOf = (unit: Ambulance) =>
    dispatches.find((d) => d.emergencyId === unit.assignedEmergencyId);

  return (
    <MapContainer center={CDMX_CENTER} zoom={12} className="map" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.line}
          pathOptions={{ color: '#4dd0c7', weight: 2, dashArray: '6 6', opacity: 0.8 }}
        />
      ))}

      {clinics.map((clinic) => (
        <Marker
          key={clinic.id}
          position={[clinic.latitude, clinic.longitude]}
          icon={hospitalIcon(clinic.status === 'saturated')}
        >
          <Popup>
            <strong>{clinic.name}</strong>
            <br />
            {clinic.address}
            <br />
            Capacidad {clinic.capacityLevel}
          </Popup>
        </Marker>
      ))}

      {fleet.map((unit) => {
        const emergency = emergencyOf(unit);
        return (
          <Marker
            key={unit.id}
            position={[unit.latitude, unit.longitude]}
            icon={ambulanceIcon(unit.status)}
          >
            <Popup>
              <strong>
                {unit.id} · {unit.plate}
              </strong>
              <br />
              {unit.status === 'available' && 'Disponible en zona'}
              {unit.status === 'dispatched' && 'En ruta al hospital'}
              {unit.status === 'arrived' && 'Llegó al hospital'}
              {emergency && (
                <>
                  <br />
                  Paciente: {emergency.patientName}
                  <br />
                  Destino: {emergency.clinic.name}
                </>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
