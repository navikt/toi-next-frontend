'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

export type UmamiHendelse = {
  navn: string;
  domene: string;
};

type UmamiGlobal = {
  track: (navn: string, data?: Record<string, unknown>) => void;
};

export const hentSkjerminfo = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    screenWidth: window.innerWidth.toString(),
    screenHeight: window.innerHeight.toString(),
  };
};

export const byggSporingsdata = (
  hendelse: UmamiHendelse,
  eventData?: Record<string, unknown>,
): Record<string, unknown> => ({
  ...eventData,
  ...hentSkjerminfo(),
  path: typeof window === 'undefined' ? undefined : window.location.pathname,
  domene: hendelse.domene,
});

export type UmamiKonfigurasjon = {
  naviger?: (url: string) => void;
  logg?: (hendelse: unknown, melding: string) => void;
  navigeringsforsinkelseMs?: number;
};

export type UmamiVerdi<TEvent extends UmamiHendelse> = {
  spor: (hendelse: TEvent, eventData?: Record<string, unknown>) => void;
  sporOgNaviger: (
    hendelse: TEvent,
    url: string,
    eventData?: Record<string, unknown>,
  ) => void;
};

export type UmamiProviderProps = UmamiKonfigurasjon & {
  children: ReactNode;
};

export function lagUmami<TEvent extends UmamiHendelse>() {
  const Context = createContext<UmamiVerdi<TEvent> | undefined>(undefined);

  const UmamiProvider = ({
    children,
    naviger,
    logg,
    navigeringsforsinkelseMs = 150,
  }: UmamiProviderProps) => {
    const spor = useCallback(
      (hendelse: TEvent, eventData?: Record<string, unknown>) => {
        const umami = (globalThis as { umami?: UmamiGlobal }).umami;
        if (umami) {
          umami.track(hendelse.navn, byggSporingsdata(hendelse, eventData));
        } else {
          logg?.(hendelse, 'Umami script er ikke lastet');
        }
      },
      [logg],
    );

    const sporOgNaviger = useCallback(
      (hendelse: TEvent, url: string, eventData?: Record<string, unknown>) => {
        spor(hendelse, eventData);
        setTimeout(() => {
          if (url.startsWith('http') || !naviger) {
            window.location.href = url;
          } else {
            naviger(url);
          }
        }, navigeringsforsinkelseMs);
      },
      [spor, naviger, navigeringsforsinkelseMs],
    );

    const verdi = useMemo(
      () => ({ spor, sporOgNaviger }),
      [spor, sporOgNaviger],
    );

    return <Context.Provider value={verdi}>{children}</Context.Provider>;
  };

  const useUmami = (): UmamiVerdi<TEvent> => {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error('useUmami må brukes innenfor en UmamiProvider');
    }
    return context;
  };

  return { UmamiProvider, useUmami };
}
