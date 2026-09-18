'use client';

import { Loader } from '@navikt/ds-react';

export type SidelasterProps = {
  tekst?: string;
};

export const Sidelaster = ({ tekst = 'Laster...' }: SidelasterProps) => (
  <div className='flex justify-center pt-10'>
    <Loader size='xlarge' title={tekst} />
  </div>
);
