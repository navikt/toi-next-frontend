export type Oborute = {
  apiUrl: string;
  apiRute: string;
  internUrl: string;
};

export type Tokenhenter = (forespørsel: Request) => Promise<string | undefined>;

export type OboProxyKonfigurasjon = {
  hentToken: Tokenhenter;
  lagFeilrespons?: (beskrivelse: string, status: number) => Response;
};

const standardFeilrespons = (beskrivelse: string, status: number) =>
  Response.json({ beskrivelse }, { status });

const byggUrl = (
  rute: Oborute,
  forespørsel: Request,
  overstyrtRute?: string,
) => {
  const originalUrl = new URL(forespørsel.url);
  const sti =
    overstyrtRute ??
    `${rute.apiRute}${originalUrl.pathname.replace(rute.internUrl, '')}`;
  return `${rute.apiUrl}${sti}${originalUrl.search}`;
};

export const opprettOboProxy = ({
  hentToken,
  lagFeilrespons = standardFeilrespons,
}: OboProxyKonfigurasjon) => {
  return async (
    rute: Oborute,
    forespørsel: Request,
    overstyrtRute?: string,
  ): Promise<Response> => {
    if (!rute.apiUrl) {
      return lagFeilrespons('Ingen URL oppgitt for proxy', 500);
    }

    let token: string | undefined;
    try {
      token = await hentToken(forespørsel);
    } catch {
      return lagFeilrespons('Kunne ikke hente OBO-token', 500);
    }

    if (!token) {
      return lagFeilrespons('Kunne ikke hente OBO-token', 401);
    }

    const headers = new Headers(forespørsel.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const harBody = !['GET', 'HEAD'].includes(forespørsel.method);

    try {
      const respons = await fetch(byggUrl(rute, forespørsel, overstyrtRute), {
        method: forespørsel.method,
        headers,
        body: harBody ? forespørsel.body : undefined,
        ...(harBody ? { duplex: 'half' as never } : {}),
      });

      return new Response(respons.body, {
        status: respons.status,
        statusText: respons.statusText,
        headers: respons.headers,
      });
    } catch {
      return lagFeilrespons('Feil i proxy', 500);
    }
  };
};
