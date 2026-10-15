import type { Coordinates } from './types';

/**
 * Calculos de distancia para la pantalla.
 *
 * El gateway ya manda la distancia oficial de cada despacho; esto es para lo
 * que cambia a cada segundo, como cuanto le falta a una ambulancia que va en
 * camino. Se calcula aqui para no pedirle al servidor un numero que el
 * navegador puede sacar solo.
 */

const RADIO_TIERRA_KM = 6371;

/** La misma velocidad que usa la simulacion de la flota en el gateway. */
const VELOCIDAD_KMH = 45;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/**
 * Distancia en linea recta entre dos puntos (formula del semiverseno).
 *
 * Es una linea recta, no un recorrido por calles: sirve para dar una idea, no
 * para navegar. Las rutas reales quedan pendientes para una entrega siguiente.
 */
export function distanciaKm(desde: Coordinates, hasta: Coordinates): number {
  const dLat = aRadianes(hasta.latitude - desde.latitude);
  const dLon = aRadianes(hasta.longitude - desde.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(desde.latitude)) *
      Math.cos(aRadianes(hasta.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return RADIO_TIERRA_KM * 2 * Math.asin(Math.sqrt(a));
}

/** Minutos aproximados para recorrer una distancia a velocidad de traslado. */
export function minutosDeViaje(km: number): number {
  return Math.max(1, Math.round((km / VELOCIDAD_KMH) * 60));
}

/**
 * Lo que le falta a una unidad para terminar su viaje.
 *
 * Si todavia va por el paciente, cuenta los dos tramos: llegar a recogerlo y
 * despues llevarlo al hospital.
 */
export function kmRestantes(
  posicion: Coordinates,
  recoge: Coordinates | null,
  hospital: Coordinates | null
): number | null {
  if (!hospital) return null;
  if (recoge) {
    return distanciaKm(posicion, recoge) + distanciaKm(recoge, hospital);
  }
  return distanciaKm(posicion, hospital);
}

/** Formatea una distancia como la leeria un operador: "1.4 km" o "750 m". */
export function enTexto(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
