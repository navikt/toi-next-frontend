export type MswServer = {
  close: () => void;
  listen: (valg?: Record<string, unknown>) => void;
};

export type MswInstrumenteringKonfigurasjon = {
  hentServer: () => Promise<MswServer>;
  logg?: (melding: string) => void;
};

const globalForMsw = globalThis as typeof globalThis & {
  __toiMswListening?: boolean;
  __toiMswFetchGuarded?: boolean;
  __toiMswDefinePropertyGuarded?: boolean;
  __toiMswReinitializing?: boolean;
  __toiMswInstallingFetchGuard?: boolean;
  __toiMswOriginalDefineProperty?: typeof Object.defineProperty;
  __toiMswServer?: MswServer;
};

const reetablerMsw = (logg?: (melding: string) => void) => {
  if (globalForMsw.__toiMswReinitializing || !globalForMsw.__toiMswListening) return;

  globalForMsw.__toiMswReinitializing = true;
  try {
    globalForMsw.__toiMswServer?.close();
    globalForMsw.__toiMswServer?.listen({ onUnhandledRequest: 'bypass' });
    logg?.('MSW re-etablert etter fetch-endring (HMR)');
  } finally {
    globalForMsw.__toiMswFetchGuarded = false;
    installerFetchGuard(logg);
    globalForMsw.__toiMswReinitializing = false;
  }
};

const installerDefinePropertyGuard = (logg?: (melding: string) => void) => {
  if (globalForMsw.__toiMswDefinePropertyGuarded) return;

  globalForMsw.__toiMswDefinePropertyGuarded = true;
  globalForMsw.__toiMswOriginalDefineProperty = Object.defineProperty;

  Object.defineProperty = function (target, property, attributes) {
    const resultat = globalForMsw.__toiMswOriginalDefineProperty!(target, property, attributes);

    if (
      target === globalThis &&
      property === 'fetch' &&
      !globalForMsw.__toiMswInstallingFetchGuard
    ) {
      reetablerMsw(logg);
    }

    return resultat;
  };
};

const installerFetchGuard = (logg?: (melding: string) => void) => {
  if (globalForMsw.__toiMswFetchGuarded) return;

  globalForMsw.__toiMswFetchGuarded = true;
  let gjeldendeFetch = globalThis.fetch;

  globalForMsw.__toiMswInstallingFetchGuard = true;
  Object.defineProperty(globalThis, 'fetch', {
    get() {
      return gjeldendeFetch;
    },
    set(nyFetch: typeof fetch) {
      gjeldendeFetch = nyFetch;
      reetablerMsw(logg);
    },
    configurable: true,
    enumerable: true,
  });
  globalForMsw.__toiMswInstallingFetchGuard = false;
};

export const startMswInstrumentering = async ({
  hentServer,
  logg = console.log,
}: MswInstrumenteringKonfigurasjon) => {
  if (globalForMsw.__toiMswListening) return;

  const server = await hentServer();
  globalForMsw.__toiMswServer = server;
  server.listen({ onUnhandledRequest: 'bypass' });
  globalForMsw.__toiMswListening = true;
  installerDefinePropertyGuard(logg);
  installerFetchGuard(logg);
  logg('MSW node-server startet');
};