import { useState } from 'react';

interface Props {
  gatewayUrl: string;
  onError: (message: string) => void;
}

const INITIAL = {
  patient_name: '',
  symptoms: '',
  heart_rate: 138,
  systolic_bp: 82,
  o2_saturation: 83,
  latitude: 19.4284,
  longitude: -99.1276,
};

/**
 * Captura de una emergencia. Envía el reporte por REST al gateway; la respuesta
 * visible no llega por aquí sino por WebSocket, igual que para el resto de
 * pantallas conectadas.
 */
export function DispatchForm({ gatewayUrl, onError }: Props) {
  const [form, setForm] = useState(INITIAL);
  const [sending, setSending] = useState(false);

  const update = (field: keyof typeof INITIAL, value: string) =>
    setForm((previous) => ({
      ...previous,
      [field]: typeof INITIAL[field] === 'number' ? Number(value) : value,
    }));

  async function send() {
    if (!form.patient_name.trim() || !form.symptoms.trim()) {
      onError('Escribe el nombre del paciente y el motivo de la llamada.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${gatewayUrl}/api/v1/dispatch`, {
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
          latitude: form.latitude,
          longitude: form.longitude,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        onError(body.error ?? `El gateway respondió ${response.status}.`);
        return;
      }

      setForm({ ...INITIAL, patient_name: '', symptoms: '' });
    } catch {
      onError('No se pudo contactar al gateway. Revisa que esté levantado.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <label className="field">
        <span>Paciente</span>
        <input
          value={form.patient_name}
          onChange={(event) => update('patient_name', event.target.value)}
          placeholder="Nombre de quien reporta la urgencia"
        />
      </label>

      <label className="field">
        <span>Motivo de la llamada</span>
        <textarea
          rows={2}
          value={form.symptoms}
          onChange={(event) => update('symptoms', event.target.value)}
          placeholder="Choque vehicular en Eje Central, paciente inconsciente"
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Pulso</span>
          <input
            type="number"
            value={form.heart_rate}
            onChange={(event) => update('heart_rate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Sistólica</span>
          <input
            type="number"
            value={form.systolic_bp}
            onChange={(event) => update('systolic_bp', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Oxígeno</span>
          <input
            type="number"
            value={form.o2_saturation}
            onChange={(event) => update('o2_saturation', event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Latitud</span>
          <input
            type="number"
            step="0.0001"
            value={form.latitude}
            onChange={(event) => update('latitude', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Longitud</span>
          <input
            type="number"
            step="0.0001"
            value={form.longitude}
            onChange={(event) => update('longitude', event.target.value)}
          />
        </label>
      </div>

      <button className="button" onClick={send} disabled={sending}>
        {sending ? 'Despachando...' : 'Despachar ambulancia'}
      </button>
    </div>
  );
}
