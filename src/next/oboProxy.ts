export type Oborute = {
  apiUrl: string;
  apiRute: string;
  internUrl: string;
  scope?: string;
  audience?: string;
  internUrlWithoutBaseUrl?: string;
};

export type Tokenhenter = (forespørsel: Request) => Promise<string | undefined>;

export type OboProxyKonfigurasjon = {
  hentToken: Tokenhenter;
  lagFeilrespons?: (beskrivelse: string, status: number) => Response;
  byggMålUrl?: (
    rute: Oborute,
    forespørsel: Request,
    overstyrtRute?: string,
  ) => string;
  normaliserRespons?: (
    respons: Response,
    forespørsel: Request,
  ) => Response | Promise<Response>;
};

const standardFeilrespons = (beskrivelse: string, status: number) =>
  Response.json({ beskrivelse }, { status });

const standardByggUrl = (
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
  byggMålUrl = standardByggUrl,
  normaliserRespons,
}: OboProxyKonfigurasjon) => {
  return async (
    rute: Oborute,
    forespørsel: Request,
    overstyrtRute?: string,
    overstyrtBody?: Record<string, unknown>,
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
    const brukOverstyrtBody = harBody && overstyrtBody !== undefined;

    if (brukOverstyrtBody) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const respons = await fetch(
        byggMålUrl(rute, forespørsel, overstyrtRute),
        {
          method: forespørsel.method,
          headers,
          body: brukOverstyrtBody
            ? JSON.stringify(overstyrtBody)
            : harBody
              ? forespørsel.body
              : undefined,
          ...(harBody && !brukOverstyrtBody ? { duplex: 'half' as never } : {}),
        },
      );

      const passthrough = new Response(respons.body, {
        status: respons.status,
        statusText: respons.statusText,
        headers: respons.headers,
      });

      return normaliserRespons
        ? await normaliserRespons(passthrough, forespørsel)
        : passthrough;
    } catch {
      return lagFeilrespons('Feil i proxy', 500);
    }
  };
};
