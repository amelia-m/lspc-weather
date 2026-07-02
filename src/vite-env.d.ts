/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIXTURES?: string;
  readonly VITE_NWS_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
