// Samme verdi som CONSOLE_ERROR_PREFIX i @nais/apm; `{` betyr at logger.error fikk et objekt uten Error.
const SYNTETISK_LOGGERFEIL_PREFIX = 'console.error: {';

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
  };
  if (
    typeof payload.value === 'string' &&
    payload.value.startsWith(SYNTETISK_LOGGERFEIL_PREFIX)
  ) {
    return null;
  }
  // Loggmeldinger kan inneholde personopplysninger; de finnes uansett i Loki.
  delete payload.context?.console_message;
  return hendelse;
}
