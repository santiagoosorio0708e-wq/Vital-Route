/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del API Gateway (Node.js). Se define en web/.env.local */
  readonly VITE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
