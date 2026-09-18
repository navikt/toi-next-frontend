'use client';

import { Alert, BodyLong, BodyShort, Button } from '@navikt/ds-react';
import { useEffect, useState } from 'react';
import type { ZodError } from 'zod';

export type FeilmeldingProps = {
  tittel?: string;
  beskrivelse?: string;
  statuskode?: number;
  zodError?: ZodError;
  standardBeskrivelse?: string;
  loginUrl?: (statuskode: number) => string | undefined;
  loggZodError?: (feil: ZodError) => void;
};

const STANDARD_BESKRIVELSE =
  'Det skjedde en uventet feil. Vennligst prøv igjen senere.';

export const Feilmelding = ({
  tittel,
  beskrivelse,
  statuskode,
  zodError,
  standardBeskrivelse = STANDARD_BESKRIVELSE,
  loginUrl,
  loggZodError,
}: FeilmeldingProps) => {
  const [visDetaljer, setVisDetaljer] = useState(false);

  useEffect(() => {
    if (statuskode === undefined || !loginUrl) {
      return;
    }
    const url = loginUrl(statuskode);
    if (url) {
      window.location.href = url;
    }
  }, [statuskode, loginUrl]);

  if (zodError) {
    loggZodError?.(zodError);
    return (
      <Alert className='w-full' style={{ margin: '1rem' }} variant='error'>
        <strong>Feil ved validering av data (ZodError)</strong>
        {tittel && <BodyLong>{tittel}</BodyLong>}
        <BodyShort>Antall feil {zodError.issues.length}</BodyShort>
        <Button
          className='mt-4 mb-4'
          size='small'
          variant={visDetaljer ? 'secondary-neutral' : 'secondary'}
          onClick={() => setVisDetaljer(!visDetaljer)}
        >
          {visDetaljer ? 'Skjul' : 'Vis'} detaljert feilmelding
        </Button>
        {visDetaljer && (
          <div>
            {zodError.issues.map((issue, index) => (
              <div key={index} className='mb-2'>
                <dd>
                  <strong>{issue.code}:</strong> {issue.message}
                </dd>
                <dt>
                  <strong>Path:</strong>{' '}
                  {issue.path && <span> {issue.path.join('.')}</span>}
                </dt>
              </div>
            ))}
          </div>
        )}
      </Alert>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <Alert style={{ margin: '1rem' }} variant='error'>
        <strong>{tittel ?? 'Noe gikk galt!'}</strong>
        <BodyLong>{beskrivelse ?? standardBeskrivelse}</BodyLong>
      </Alert>
    </div>
  );
};
