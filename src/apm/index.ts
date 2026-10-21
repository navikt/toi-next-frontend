// Samme verdi som CONSOLE_ERROR_PREFIX i @nais/apm; `{` betyr at logger.error fikk et objekt uten Error.
const SYNTETISK_LOGGERFEIL_PREFIX = 'console.error: {';

/** Adresser til Dekoratøren. Brukes i `faro.ignoreUrls` og for å forkaste feil fra Dekoratøren. */
export const DEKORATØR_URLER: readonly RegExp[] = [
  /^https:\/\/cdn\.nav\.no\/personbruker\/nav-dekoratoren\//,
  /^https:\/\/dekoratoren\.ekstern\.dev\.nav\.no\//,
  /^https:\/\/dekoratoren-beta\.intern\.dev\.nav\.no\//,
  /^https:\/\/dekoratoren-beta-tms\.intern\.dev\.nav\.no\//,
  /^https:\/\/www\.nav\.no\/dekoratoren\//,
];

// Feil fra nettleseren eller utvidelser, ikke fra koden vår.
const NETTLESERSTØY = [
  /window\.ethereum/, // Krypto-lommebok i Brave
  /^Script error\.?$/, // Skript fra et annet domene, uten detaljer
];

const MAKS_KALLSTAKK = /Maximum call stack size exceeded/;

export interface ApmFeilkontekst {
  statuskode?: number;
  url?: string;
  feilkode?: string;
}

export interface ApmCaptureValg {
  context?: Record<string, string | number | undefined>;
  fingerprint?: string;
}

export interface ApmFeilrapporteringValg {
  /** Sett til false i testmodus, der SDK-et ikke initialiseres. */
  aktiv: boolean;
  /** Typisk en dynamisk import av captureException fra @nais/apm. */
  captureException: (feil: unknown, valg: ApmCaptureValg) => unknown;
}

interface ApmHendelse {
  type: string;
  payload: object;
  meta?: { page?: { url?: string } };
}

interface Stakkramme {
  filename?: string;
}

function utenSøkOgAnker(url: string): string {
  return url.split(/[?#]/)[0];
}

function sideadresse(hendelse: ApmHendelse): string | undefined {
  const url =
    hendelse.meta?.page?.url ??
    (typeof window !== 'undefined' ? window.location?.href : undefined);
  return url ? utenSøkOgAnker(url) : undefined;
}

function kommerFraDekoratøren(rammer: Stakkramme[]): boolean {
  return rammer.some(
    ({ filename }) =>
      typeof filename === 'string' &&
      DEKORATØR_URLER.some((url) => url.test(filename)),
  );
}

function pekerBareTilSiden(rammer: Stakkramme[], side: string | undefined): boolean {
  return (
    side !== undefined &&
    rammer.length > 0 &&
    rammer.every(
      ({ filename }) =>
        typeof filename === 'string' && utenSøkOgAnker(filename) === side,
    )
  );
}

function lagEndepunktNøkkel(url: string): string {
  return new URL(url, 'https://apm.invalid').pathname
    .split('/')
    .map((segment) => (/\d/.test(segment) ? ':id' : segment))
    .join('/');
}

export function lagApmFeilrapportering({
  aktiv,
  captureException,
}: ApmFeilrapporteringValg) {
  const rapporterteFeil = new WeakSet<object>();

  const rapporterFeil = (feil: unknown, kontekst?: ApmFeilkontekst): void => {
    if (!aktiv || typeof window === 'undefined') return;
    if (typeof feil === 'object' && feil !== null) {
      if (rapporterteFeil.has(feil)) return;
      rapporterteFeil.add(feil);
    }
    captureException(feil, {
      context: {
        feilkode: kontekst?.feilkode,
        statuskode: kontekst?.statuskode,
        url: kontekst?.url,
      },
      fingerprint:
        kontekst?.statuskode && kontekst.url
          ? `${kontekst.statuskode} ${lagEndepunktNøkkel(kontekst.url)}`
          : undefined,
    });
  };

  const rapporterApiFeil = (statuskode: number, url: string): void => {
    if (statuskode === 401 || statuskode === 403) return;
    const feil = new Error(`API-kall feilet med status ${statuskode}`);
    feil.name = 'ApiFeil';
    rapporterFeil(feil, { statuskode, url });
  };

  return { rapporterFeil, rapporterApiFeil };
}

export function filtrerApmHendelse<T extends ApmHendelse>(hendelse: T): T | null {
  if (hendelse.type !== 'exception') return hendelse;
  const payload = hendelse.payload as {
    value?: unknown;
    context?: Record<string, unknown>;
    stacktrace?: { frames?: Stakkramme[] };
  };
  const melding = typeof payload.value === 'string' ? payload.value : '';
  const rammer = payload.stacktrace?.frames ?? [];
  if (
    melding.startsWith(SYNTETISK_LOGGERFEIL_PREFIX) ||
    NETTLESERSTØY.some((mønster) => mønster.test(melding)) ||
    kommerFraDekoratøren(rammer) ||
    (MAKS_KALLSTAKK.test(melding) &&
      pekerBareTilSiden(rammer, sideadresse(hendelse)))
  ) {
    return null;
  }
  // Loggmeldinger kan inneholde personopplysninger; de finnes uansett i Loki.
  delete payload.context?.console_message;
  return hendelse;
}
