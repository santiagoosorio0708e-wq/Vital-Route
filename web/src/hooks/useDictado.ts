import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz para el operador telefonico.
 *
 * Mientras alguien describe una emergencia por telefono, escribir es tiempo que
 * no se le dedica a preguntar lo que falta. Con esto el operador aprieta el
 * microfono y lo que escucha se va escribiendo solo.
 *
 * Usa el reconocimiento de voz del navegador, que en Chrome viene incluido. Si
 * el navegador no lo trae, `disponible` queda en false y la pantalla
 * simplemente no muestra el boton.
 */

/** Lo minimo de la API del navegador que se usa aqui. */
interface ResultadoVoz {
  isFinal: boolean;
  0: { transcript: string };
}

interface EventoVoz {
  resultIndex: number;
  results: { length: number; [index: number]: ResultadoVoz };
}

interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((evento: EventoVoz) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocedor = new () => Reconocedor;

function obtenerConstructor(): ConstructorReconocedor | null {
  const ventana = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
}

export function useDictado(alEscuchar: (texto: string) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const reconocedorRef = useRef<Reconocedor | null>(null);

  // El callback cambia en cada render; se guarda aparte para no reiniciar el
  // reconocedor a media frase.
  const alEscucharRef = useRef(alEscuchar);
  alEscucharRef.current = alEscuchar;

  const disponible = obtenerConstructor() !== null;

  useEffect(() => {
    return () => reconocedorRef.current?.stop();
  }, []);

  const alternar = useCallback(() => {
    if (escuchando) {
      reconocedorRef.current?.stop();
      return;
    }

    const Constructor = obtenerConstructor();
    if (!Constructor) return;

    const reconocedor = new Constructor();
    reconocedor.lang = 'es-MX';
    reconocedor.continuous = true;
    reconocedor.interimResults = false;

    reconocedor.onresult = (evento) => {
      let dicho = '';
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        if (resultado.isFinal) dicho += resultado[0].transcript;
      }
      if (dicho.trim()) alEscucharRef.current(dicho.trim());
    };

    reconocedor.onerror = () => setEscuchando(false);
    reconocedor.onend = () => setEscuchando(false);

    reconocedorRef.current = reconocedor;
    reconocedor.start();
    setEscuchando(true);
  }, [escuchando]);

  return { disponible, escuchando, alternar };
}
