/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIXTURES?: string;
  /** Which three-day layout the Ceiling & sky card draws while the
   *  maintainer tries them (forecastReach.ts, ThreeDayLayout). */
  readonly VITE_THREE_DAY?: string;
  readonly VITE_NWS_BASE?: string;
  readonly VITE_IEM_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
