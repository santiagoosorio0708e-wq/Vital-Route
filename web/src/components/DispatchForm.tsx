import { useEffect, useRef, useState } from 'react';
import { buscarLugares, describirPunto, ubicacionDelDispositivo } from '../lib/geocoding';
import { useDictado } from '../hooks/useDictado';
import type { PickedPlace } from '../lib/types';

interface Props {
  gatewayUrl: string;
  /** Lugar de la emergencia. Lo comparte con el mapa, que tambien lo puede fijar. */
  lugar: PickedPlace | null;
  onLugarChange: (lugar: PickedPlace | null) => void;
  /** Mientras esta encendido, el siguiente clic en el mapa fija el lugar. */
  modoMarcado: boolean;
  onModoMarcado: (activo: boolean) => void;
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
 * Tres llamadas de ejemplo, listas para cargar con un clic.
 *
 * Sirven para ensayar y para mostrar el sistema sin teclear nada: quien lo
 * ve puede comparar como reacciona el motor de decision ante un paciente
 * grave y ante uno que puede esperar.
 */
const CASOS = [
  {
    etiqueta: 'Crítico',
    patient_name: 'Ana Reyes',
    symptoms:
      'Atropellada en Paseo de la Reforma, no responde y respira con dificultad',
    heart_rate: 138,
    systolic_bp: 78,
    o2_saturation: 81,
    lugar: {
      latitude: 19.4270,
      longitude: -99.1677,
      label: 'Paseo de la Reforma, Juárez',
    },
  },
  {
    etiqueta: 'Moderado',
    patient_name: 'Miguel Tapia',
    symptoms: 'Dolor en el pecho desde hace una hora, sudoración fría, consciente',
    heart_rate: 112,
    systolic_bp: 96,
    o2_saturation: 92,
    lugar: {
      latitude: 19.4194,
      longitude: -99.1420,
      label: 'Avenida Cuauhtémoc, Doctores',
    },
  },
  {
    etiqueta: 'Leve',
    patient_name: 'Lucía Ferrer',
    symptoms: 'Caída en bicicleta, golpe en el brazo derecho, camina sin ayuda',
    heart_rate: 88,
    systolic_bp: 118,
    o2_saturation: 98,
    lugar: {
      latitude: 19.4119,
      longitude: -99.1710,
      label: 'Avenida Insurgentes Sur, Roma Sur',
    },
  },
] as const;

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
export function DispatchForm({
  gatewayUrl,
  lugar,
  onLugarChange,
  modoMarcado,
  onModoMarcado,
  onError,
}: Props) {
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
    onModoMarcado(false);
    setConsulta('');
    setSugerencias([]);
  }

  /** Carga una llamada de ejemplo completa, lugar incluido. */
  function cargarCaso(caso: (typeof CASOS)[number]) {
    setForm({
      patient_name: caso.patient_name,
      symptoms: caso.symptoms,
      heart_rate: caso.heart_rate,
      systolic_bp: caso.systolic_bp,
      o2_saturation: caso.o2_saturation,
    });
    onLugarChange({ ...caso.lugar });
    onModoMarcado(false);
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
      <div className="cases">
        <span className="hint">Llamadas de ejemplo</span>
        <div className="shortcuts">
          {CASOS.map((caso) => (
            <button
              key={caso.etiqueta}
              type="button"
              className="chip"
              onClick={() => cargarCaso(caso)}
            >
              {caso.etiqueta}
            </button>
          ))}
        </div>
      </div>

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
              onClick={() => {
                onLugarChange(null);
                onModoMarcado(false);
              }}
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
              <button
                type="button"
                className={`chip${modoMarcado ? ' chip--on' : ''}`}
                onClick={() => onModoMarcado(!modoMarcado)}
              >
                {modoMarcado ? 'Haz clic en el mapa' : 'Marcar en el mapa'}
              </button>
            </div>

            {modoMarcado && (
              <p className="hint">
                El mapa está esperando el punto. Después lo puedes arrastrar para
                ajustarlo.
              </p>
            )}
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
