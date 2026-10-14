import { useEffect, useRef, useState } from 'react';
import { buscarLugares, describirPunto, ubicacionDelDispositivo } from '../lib/geocoding';
import { useDictado } from '../hooks/useDictado';
import type { PickedPlace } from '../lib/types';

interface Props {
  gatewayUrl: string;
  /** Lugar de la emergencia. Lo comparte con el mapa, que tambien lo puede fijar. */
  lugar: PickedPlace | null;
  onLugarChange: (lugar: PickedPlace | null) => void;
  onError: (message: string) => void;
}

const SIGNOS_INICIALES = {
  patient_name: '',
  symptoms: '',
  heart_rate: 138,
  systolic_bp: 82,
  o2_saturation: 83,
};

/** Milisegundos que se espera a que el operador deje de escribir antes de buscar. */
const PAUSA_BUSQUEDA = 500;

/**
 * Captura de una emergencia.
 *
 * El operador nunca escribe coordenadas: dice o escribe una direccion, toma la
 * ubicacion del dispositivo o marca el punto en el mapa. La conversion a
 * latitud y longitud ocurre debajo, donde nadie tiene que pensarla.
 *
 * Envia el reporte por REST al gateway; la respuesta visible no llega por aqui
 * sino por WebSocket, igual que para el resto de pantallas conectadas.
 */
export function DispatchForm({ gatewayUrl, lugar, onLugarChange, onError }: Props) {
  const [form, setForm] = useState(SIGNOS_INICIALES);
  const [enviando, setEnviando] = useState(false);

  const [consulta, setConsulta] = useState('');
  const [sugerencias, setSugerencias] = useState<PickedPlace[]>([]);
  const [buscando, setBuscando] = useState(false);
  const temporizador = useRef<number | null>(null);

  const dictado = useDictado((dicho) =>
    setForm((previo) => ({
      ...previo,
      symptoms: previo.symptoms ? `${previo.symptoms} ${dicho}` : dicho,
    }))
  );

  const actualizar = (campo: keyof typeof SIGNOS_INICIALES, valor: string) =>
    setForm((previo) => ({
      ...previo,
      [campo]: typeof SIGNOS_INICIALES[campo] === 'number' ? Number(valor) : valor,
    }));

  /** Busca direcciones cuando el operador deja de teclear. */
  useEffect(() => {
    if (temporizador.current) window.clearTimeout(temporizador.current);

    const texto = consulta.trim();
    if (texto.length < 3) {
      setSugerencias([]);
      return;
    }

    temporizador.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        setSugerencias(await buscarLugares(texto));
      } catch {
        onError('El buscador de direcciones no respondio. Marca el punto en el mapa.');
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, PAUSA_BUSQUEDA);

    return () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    };
  }, [consulta, onError]);

  function elegir(elegido: PickedPlace) {
    onLugarChange(elegido);
    setConsulta('');
    setSugerencias([]);
  }

  async function usarMiUbicacion() {
    try {
      const punto = await ubicacionDelDispositivo();
      onLugarChange({ ...punto, label: 'Ubicando...' });
      onLugarChange({ ...punto, label: await describirPunto(punto) });
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo leer la ubicacion.');
    }
  }

  async function enviar() {
    if (!form.patient_name.trim() || !form.symptoms.trim()) {
      onError('Escribe el nombre del paciente y el motivo de la llamada.');
      return;
    }
    if (!lugar) {
      onError('Falta el lugar de la emergencia. Buscalo o marcalo en el mapa.');
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch(`${gatewayUrl}/api/v1/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: form.patient_name,
          symptoms: form.symptoms,
          vitals: {
            heart_rate: form.heart_rate,
            systolic_bp: form.systolic_bp,
            o2_saturation: form.o2_saturation,
          },
          latitude: lugar.latitude,
          longitude: lugar.longitude,
        }),
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        onError(cuerpo.error ?? `El gateway respondio ${respuesta.status}.`);
        return;
      }

      setForm({ ...SIGNOS_INICIALES, patient_name: '', symptoms: '' });
      onLugarChange(null);
    } catch {
      onError('No se pudo contactar al gateway. Revisa que este levantado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="stack">
      <label className="field">
        <span>Paciente</span>
        <input
          value={form.patient_name}
          onChange={(evento) => actualizar('patient_name', evento.target.value)}
          placeholder="Nombre de quien reporta la urgencia"
        />
      </label>

      <div className="field">
        <span className="field__label">
          Motivo de la llamada
          {dictado.disponible && (
            <button
              type="button"
              className={`mic${dictado.escuchando ? ' mic--on' : ''}`}
              onClick={dictado.alternar}
              title={dictado.escuchando ? 'Dejar de dictar' : 'Dictar con la voz'}
            >
              <span className="mic__dot" aria-hidden="true" />
              {dictado.escuchando ? 'Escuchando' : 'Dictar'}
            </button>
          )}
        </span>
        <textarea
          rows={2}
          value={form.symptoms}
          onChange={(evento) => actualizar('symptoms', evento.target.value)}
          placeholder="Choque vehicular en Eje Central, paciente inconsciente"
        />
      </div>

      <div className="field">
        <span className="field__label">¿Dónde está el paciente?</span>

        {lugar ? (
          <div className="place">
            <span className="place__pin" aria-hidden="true" />
            <span className="place__name">{lugar.label}</span>
            <button
              type="button"
              className="place__clear"
              onClick={() => onLugarChange(null)}
              title="Elegir otro lugar"
            >
              cambiar
            </button>
          </div>
        ) : (
          <>
            <input
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              placeholder="Calle, colonia o punto de referencia"
            />

            {buscando && <p className="hint">Buscando direcciones...</p>}

            {sugerencias.length > 0 && (
              <ul className="suggestions">
                {sugerencias.map((sugerencia) => (
                  <li key={`${sugerencia.latitude},${sugerencia.longitude}`}>
                    <button type="button" onClick={() => elegir(sugerencia)}>
                      {sugerencia.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="shortcuts">
              <button type="button" className="chip" onClick={usarMiUbicacion}>
                Usar mi ubicación
              </button>
              <span className="hint">o haz clic en el mapa</span>
            </div>
          </>
        )}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Pulso</span>
          <input
            type="number"
            value={form.heart_rate}
            onChange={(evento) => actualizar('heart_rate', evento.target.value)}
          />
        </label>
        <label className="field">
          <span>Sistólica</span>
          <input
            type="number"
            value={form.systolic_bp}
            onChange={(evento) => actualizar('systolic_bp', evento.target.value)}
          />
        </label>
        <label className="field">
          <span>Oxígeno</span>
          <input
            type="number"
            value={form.o2_saturation}
            onChange={(evento) => actualizar('o2_saturation', evento.target.value)}
          />
        </label>
      </div>

      <button className="button" onClick={enviar} disabled={enviando}>
        {enviando ? 'Despachando...' : 'Despachar ambulancia'}
      </button>
    </div>
  );
}
