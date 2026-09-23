import { z, type ZodType } from 'zod';

export type ApiErrorDetaljer = {
  url: string;
  status: number;
  statusText: string;
  detaljer: unknown;
};

export class ApiError extends Error {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly detaljer: unknown;

  constructor({ url, status, statusText, detaljer }: ApiErrorDetaljer) {
    super(`HTTP ${status}: ${statusText || 'Ukjent feil'}`);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
    this.statusText = statusText;
    this.detaljer = detaljer;
  }
}

export type ApiFeilinfo = {
  url: string;
  status: number;
  statusText: string;
  detaljer: unknown;
  skjulFeilmelding: boolean;
};

export type Nettverksfeilinfo = {
  url: string;
  feil: unknown;
};

export type ValideringsfeilInfo = {
  antallFeil: number;
  schema: string;
  feil: Array<{ sti: string; melding: string; kode: string; verdi: string }>;
};

export type Forespørselsvalg = Omit<RequestInit, 'body' | 'method'> & {
  queryParams?: URLSearchParams;
  skjulFeilmelding?: boolean | number | number[];
};

export type FetcherKonfigurasjon = {
  baseUrl?: string;
  fetch?: typeof fetch;
  standardvalg?: Omit<RequestInit, 'body' | 'method'>;
  timeoutMs?: number;
  maxForsøk?: number;
  lagFeil?: (info: ApiFeilinfo) => Error;
  lagNettverksfeil?: (info: Nettverksfeilinfo) => Error;
  loggValidering?: (info: ValideringsfeilInfo) => void;
};

export type Fetcher = {
  get<T>(url: string, valg?: Forespørselsvalg): Promise<T>;
  post<T>(url: string, body?: unknown, valg?: Forespørselsvalg): Promise<T>;
  put<T>(url: string, body?: unknown, valg?: Forespørselsvalg): Promise<T>;
  delete<T>(url: string, body?: unknown, valg?: Forespørselsvalg): Promise<T>;
  getMedSchema<T>(
    schema: ZodType<T>,
    url: string,
    valg?: Forespørselsvalg,
  ): Promise<T>;
  validerSchema<T>(schema: ZodType<T>, data: unknown): T;
};

const byggUrl = (
  baseUrl: string | undefined,
  url: string,
  queryParams?: URLSearchParams,
) => {
  const fullUrl = baseUrl ? new URL(url, baseUrl).toString() : url;

  if (!queryParams || queryParams.size === 0) {
    return fullUrl;
  }

  return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryParams}`;
};

const lesRespons = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const tekst = await response.text();
  if (!tekst) {
    return undefined;
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      return JSON.parse(tekst) as unknown;
    } catch {
      return tekst;
    }
  }

  return tekst;
};

const serialiserBody = (body: unknown) =>
  JSON.stringify(body, (_nøkkel, verdi: unknown) =>
    verdi instanceof Set ? [...verdi] : verdi,
  );

const skalSkjuleFeil = (
  skjul: boolean | number | number[] | undefined,
  status: number,
): boolean => {
  if (typeof skjul === 'boolean') return skjul;
  if (typeof skjul === 'number') return status === skjul;
  if (Array.isArray(skjul)) return skjul.includes(status);
  return false;
};

const erNettverksfeil = (feil: unknown): boolean => {
  const melding = feil instanceof Error ? feil.message : String(feil);
  return (
    feil instanceof TypeError ||
    (feil instanceof Error && feil.name === 'AbortError') ||
    melding.includes('Failed to fetch') ||
    melding.includes('NetworkError')
  );
};

const vent = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const byggSignal = (
  signal: AbortSignal | null | undefined,
  timeoutMs?: number,
): AbortSignal | undefined => {
  if (!timeoutMs) return signal ?? undefined;
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

const formaterZodSti = (sti: PropertyKey[]): string => {
  if (sti.length === 0) return '(rot)';

  let tekst = '';
  for (const segment of sti) {
    if (typeof segment === 'number') {
      tekst += `[${segment}]`;
    } else {
      tekst += tekst.length === 0 ? String(segment) : `.${String(segment)}`;
    }
  }
  return tekst;
};

const beskrivVerdi = (data: unknown, sti: PropertyKey[]): string => {
  try {
    let peker: unknown = data;
    for (const segment of sti) {
      if (peker === null || peker === undefined) return 'mangler verdi';
      peker = (peker as Record<PropertyKey, unknown>)[segment];
    }
    if (peker === null) return 'null';
    if (peker === undefined) return 'undefined';
    if (typeof peker === 'string') return `streng (lengde=${peker.length})`;
    if (typeof peker === 'number') return `tall (${peker})`;
    if (typeof peker === 'boolean') return `bool (${peker})`;
    if (Array.isArray(peker)) return `liste (lengde=${peker.length})`;
    if (peker instanceof Date) return `dato (${peker.toISOString()})`;
    if (typeof peker === 'object') {
      const nøkler = Object.keys(peker as Record<string, unknown>);
      return `objekt (nøkler=${nøkler.slice(0, 5).join(', ')})`;
    }
    return `type ${typeof peker}`;
  } catch {
    return 'ukjent verdi';
  }
};

const esResponsSchema = z.object({
  hits: z.object({
    hits: z.array(z.object({ _source: z.unknown() })),
  }),
});

export const hentEsKilder = (data: unknown): unknown[] =>
  esResponsSchema.parse(data).hits.hits.map((hit) => hit._source);

export const hentEsFørsteKilde = (data: unknown): unknown =>
  esResponsSchema.parse(data).hits.hits[0]?._source;

export const createFetcher = ({
  baseUrl,
  fetch: fetchImplementasjon,
  standardvalg,
  timeoutMs,
  maxForsøk = 0,
  lagFeil,
  lagNettverksfeil,
  loggValidering,
}: FetcherKonfigurasjon = {}): Fetcher => {
  // Resolveres ved kalltid slik at bytte av global fetch (testmocks, MSW) respekteres.
  const gjørFetch = (url: string, init: RequestInit): Promise<Response> =>
    (fetchImplementasjon ?? globalThis.fetch)(url, init);
  const validerSchema = <T>(schema: ZodType<T>, data: unknown): T => {
    const resultat = schema.safeParse(data);
    if (!resultat.success && loggValidering) {
      loggValidering({
        antallFeil: resultat.error.issues.length,
        schema: schema.description ?? schema.constructor.name,
        feil: resultat.error.issues.map((issue) => ({
          sti: formaterZodSti(issue.path),
          melding: issue.message,
          kode: issue.code,
          verdi: beskrivVerdi(data, issue.path),
        })),
      });
    }
    return data as T;
  };

  const utførFetch = async (
    url: string,
    init: RequestInit,
  ): Promise<Response> => {
    for (let forsøk = 0; forsøk <= maxForsøk; forsøk++) {
      try {
        return await gjørFetch(url, {
          ...init,
          signal: byggSignal(init.signal, timeoutMs),
        });
      } catch (feil) {
        if (forsøk < maxForsøk && erNettverksfeil(feil)) {
          await vent(2 ** forsøk * 1000);
          continue;
        }
        if (lagNettverksfeil) {
          throw lagNettverksfeil({ url, feil });
        }
        throw feil;
      }
    }
    throw new Error('Maks antall forsøk nådd');
  };

  const forespørsel = async <T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    valg?: Forespørselsvalg,
  ): Promise<T> => {
    const { queryParams, skjulFeilmelding, ...requestValg } = valg ?? {};
    const målUrl = byggUrl(baseUrl, url, queryParams);
    const respons = await utførFetch(målUrl, {
      ...standardvalg,
      ...requestValg,
      method,
      headers: {
        ...standardvalg?.headers,
        ...requestValg.headers,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: serialiserBody(body) }),
    });
    const data = await lesRespons(respons);

    if (!respons.ok) {
      const info: ApiFeilinfo = {
        url: respons.url || målUrl,
        status: respons.status,
        statusText: respons.statusText,
        detaljer: data,
        skjulFeilmelding: skalSkjuleFeil(skjulFeilmelding, respons.status),
      };
      throw lagFeil ? lagFeil(info) : new ApiError(info);
    }

    return data as T;
  };

  return {
    get: (url, valg) => forespørsel(url, 'GET', undefined, valg),
    post: (url, body, valg) => forespørsel(url, 'POST', body, valg),
    put: (url, body, valg) => forespørsel(url, 'PUT', body, valg),
    delete: (url, body, valg) => forespørsel(url, 'DELETE', body, valg),
    getMedSchema: async (schema, url, valg) =>
      schema.parse(await forespørsel(url, 'GET', undefined, valg)),
    validerSchema,
  };
};
