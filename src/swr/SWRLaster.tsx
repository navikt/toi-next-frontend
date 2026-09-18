'use client';

import type { ReactNode } from 'react';
import type { SWRResponse } from 'swr';

type SWRHookRespons<T> = SWRResponse<T, Error> | undefined;

export type SWRLasterProps<T extends unknown[]> = {
  hooks: { [K in keyof T]: SWRHookRespons<T[K]> };
  laster?: ReactNode;
  renderFeil?: (feil: Error) => ReactNode;
  visLoaderUnderValidering?: boolean;
  tillatDelvisData?: boolean;
  feilSkjulerInnhold?: boolean;
  children: (...data: T) => ReactNode;
};

export const SWRLaster = <T extends unknown[]>({
  hooks,
  laster = null,
  renderFeil,
  visLoaderUnderValidering = false,
  tillatDelvisData = false,
  feilSkjulerInnhold = false,
  children,
}: SWRLasterProps<T>): ReactNode => {
  const lasterData = hooks.some(
    (hook) =>
      !hook ||
      hook.isLoading ||
      (visLoaderUnderValidering && hook.isValidating),
  );

  if (lasterData) {
    return laster;
  }

  const feil = hooks.find((hook) => hook?.error)?.error;
  const harData = tillatDelvisData
    ? hooks.some((hook) => hook?.data !== undefined)
    : hooks.every((hook) => hook?.data !== undefined);

  if (!harData) {
    return feil && renderFeil ? renderFeil(feil) : null;
  }

  if (feil && feilSkjulerInnhold) {
    return renderFeil ? renderFeil(feil) : null;
  }

  const innhold = children(...(hooks.map((hook) => hook?.data) as T));

  if (feil && renderFeil) {
    return (
      <>
        {renderFeil(feil)}
        {innhold}
      </>
    );
  }

  return innhold;
};
