import type { Coordinates, PickedPlace } from './types';

/**
 * Traduccion entre direcciones y coordenadas.
 *
 * Nadie en una sala de urgencias conoce la latitud del lugar donde se cayo un
 * paciente, pero todos saben decir "metro Pino Suarez" o "Eje Central con
 * Izazaga". Este modulo convierte una cosa en la otra usando el buscador de
 * OpenStreetMap, que es abierto y no pide llave.
 *
 * El servicio pide no pasar de una consulta por segundo, asi que quien llame a
 * `buscarLugares` debe esperar a que el operador deje de escribir.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Caja aproximada de la zona metropolitana, para no traer resultados de otro estado. */
const CDMX_VIEWBOX = '-99.37,19.05,-98.90,19.60';

interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

/** Acorta "Hospital X, Calle, Colonia, Alcaldia, CDMX, 06720, Mexico" a lo util. */
function acortar(display: string, name?: string): string {
  const partes = display.split(',').map((parte) => parte.trim());
  const utiles = partes
    .filter((parte) => !/^\d{5}$/.test(parte) && parte !== 'México' && parte !== 'Mexico')
    .slice(0, 3);

  const corto = utiles.join(', ');
  // Si el lugar tiene nombre propio y no quedo en el texto, se antepone.
  if (name && !corto.toLowerCase().includes(name.toLowerCase())) {
    return `${name}, ${corto}`;
  }
  return corto;
}

/** Sugerencias para lo que el operador va escribiendo. */
export async function buscarLugares(consulta: string): Promise<PickedPlace[]> {
  const texto = consulta.trim();
  if (texto.length < 3) return [];

  const url =
    `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=mx` +
    `&viewbox=${CDMX_VIEWBOX}&bounded=0&accept-language=es&q=${encodeURIComponent(texto)}`;

  const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!respuesta.ok) throw new Error(`El buscador respondio ${respuesta.status}`);

  const lugares: NominatimPlace[] = await respuesta.json();
  return lugares.map((lugar) => ({
    latitude: Number(lugar.lat),
    longitude: Number(lugar.lon),
    label: acortar(lugar.display_name, lugar.name),
  }));
}

/**
 * El camino inverso: de un punto a una direccion legible. Se usa cuando el
 * operador marca en el mapa o toma la ubicacion del dispositivo, para que vea
 * en palabras a donde va a mandar la ambulancia.
 */
export async function describirPunto(punto: Coordinates): Promise<string> {
  const url =
    `${NOMINATIM}/reverse?format=jsonv2&accept-language=es` +
    `&lat=${punto.latitude}&lon=${punto.longitude}`;

  try {
    const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(String(respuesta.status));

    const lugar: NominatimPlace = await respuesta.json();
    return acortar(lugar.display_name, lugar.name);
  } catch {
    // Si el buscador no responde, el despacho igual puede salir: lo que
    // necesita el motor de triaje son las coordenadas, no el nombre.
    return 'Punto marcado en el mapa';
  }
}

/** Ubicacion del dispositivo, para cuando quien reporta ya esta en el lugar. */
export function ubicacionDelDispositivo(): Promise<Coordinates> {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Este navegador no comparte la ubicacion.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) =>
        resolver({
          latitude: posicion.coords.latitude,
          longitude: posicion.coords.longitude,
        }),
      () => rechazar(new Error('No se pudo leer la ubicacion. Revisa el permiso del navegador.')),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}
