import path from 'path';
import dotenv from 'dotenv';

// El .env vive en la raíz del monorepo, una carpeta arriba de /api.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y complétala.`
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Motor de decisión (Parte 1, FastAPI)
  pythonCoreUrl: process.env.PYTHON_CORE_URL ?? 'http://127.0.0.1:5000',

  // Firma del token con el que el gateway se identifica ante el core
  jwtSecret: required('JWT_SECRET_KEY', 'fallback_secret'),
  jwtAlgorithm: (process.env.JWT_ALGORITHM ?? 'HS256') as 'HS256',
  jwtIssuerService: 'vitalroute_gateway',

  // Cifrado de las coordenadas que viajan a la tablet del paramédico
  gpsEncryptionKey: required(
    'GPS_ENCRYPTION_KEY',
    // Valor de desarrollo. En producción se inyecta por variable de entorno.
    '0'.repeat(64)
  ),

  // Lectura de clínicas e inventario (solo SELECT)
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'vitalroute',
  },

  // Simulación de flota: cada cuántos milisegundos se recalculan posiciones
  fleetTickMs: Number(process.env.FLEET_TICK_MS ?? 2000),

  // Habilita el endpoint de simulacro, que despacha sin llamar al core de Python
  enableDispatchDrill: process.env.ENABLE_DISPATCH_DRILL === 'true',
};
