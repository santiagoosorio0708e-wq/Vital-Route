import type { Coordinates } from '../types/dispatch.types';

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Distancia en kilómetros entre dos puntos (fórmula de Haversine). */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Avanza desde un punto hacia otro una cantidad fija de kilómetros.
 * Si el paso cubre la distancia restante, devuelve el destino exacto.
 */
export function advanceTowards(
  from: Coordinates,
  to: Coordinates,
  stepKm: number
): Coordinates {
  const remaining = distanceKm(from, to);
  if (remaining <= stepKm || remaining === 0) return { ...to };

  const ratio = stepKm / remaining;
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * ratio,
    longitude: from.longitude + (to.longitude - from.longitude) * ratio,
  };
}
