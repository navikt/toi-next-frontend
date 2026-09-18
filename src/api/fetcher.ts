import type { ZodType } from 'zod';

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

export type Forespørselsvalg = Omit<RequestInit, 'body' | 'method'> & {
  queryParams?: URLSearchParams;
};

export type FetcherKonfigurasjon = {
  baseUrl?: string;
  fetch?: typeof fetch;
  standardvalg?: Forespørselsvalg;
};

export type Fetcher = {
  get<T>(url: string, valg?: Forespørselsvalg): Promise<T>;
  getMedSchema<T>(schema: ZodType<T>, url: string, valg?: Forespørselsvalg): Promise<T>;
  post<T>(url: string, body?: unknown, valg?: Forespørselsvalg): Promise<T>;
  put<T>(url: string, body?: unknown, valg?: Forespørselsvalg): Promise<T>;
  delete<T>(url: string, valg?: Forespørselsvalg): Promise<T>;
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

export const createFetcher = ({
  baseUrl,
  fetch: fetchImplementasjon = fetch,
  standardvalg,
}: FetcherKonfigurasjon = {}): Fetcher => {
  const forespørsel = async <T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    valg?: Forespørselsvalg,
  ): Promise<T> => {
    const { queryParams, ...requestValg } = valg ?? {};
    const respons = await fetchImplementasjon(byggUrl(baseUrl, url, queryParams), {
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
      throw new ApiError({
        url: respons.url || byggUrl(baseUrl, url, queryParams),
        status: respons.status,
        statusText: respons.statusText,
        detaljer: data,
      });
    }

    return data as T;
  };

  return {
    get: (url, valg) => forespørsel(url, 'GET', undefined, valg),
    getMedSchema: async (schema, url, valg) => schema.parse(await forespørsel(url, 'GET', undefined, valg)),
    post: (url, body, valg) => forespørsel(url, 'POST', body, valg),
    put: (url, body, valg) => forespørsel(url, 'PUT', body, valg),
    delete: (url, valg) => forespørsel(url, 'DELETE', undefined, valg),
  };
};