'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import type { ZodType } from 'zod';

export type SWRHookKonfigurasjon<FetchOptions = undefined> =
  SWRConfiguration & {
    nonImmutable?: boolean;
    fetchOptions?: FetchOptions;
  };

export type SWRHenteparametre<SchemaType, Body, FetchOptions> = {
  endpoint: string;
  schema: ZodType<SchemaType>;
  body?: Body;
  fetchOptions?: FetchOptions;
};

export type SWRHentData<SchemaType, Body = undefined, FetchOptions = undefined> = (
  parametre: SWRHenteparametre<SchemaType, Body, FetchOptions>,
) => Promise<SchemaType>;

export const lagSWRKonfigurasjon = <FetchOptions>(
  konfigurasjon?: SWRHookKonfigurasjon<FetchOptions>,
): SWRConfiguration => {
  const { nonImmutable, fetchOptions: _fetchOptions, ...swrKonfigurasjon } =
    konfigurasjon ?? {};

  if (nonImmutable) {
    return swrKonfigurasjon;
  }

  return {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    ...swrKonfigurasjon,
  };
};

export function useSWRGet<SchemaType, FetchOptions = undefined>(
  endpoint: string | null,
  schema: ZodType<SchemaType>,
  hentData: SWRHentData<SchemaType, undefined, FetchOptions>,
  konfigurasjon?: SWRHookKonfigurasjon<FetchOptions>,
) {
  const fetcher = endpoint
    ? () => hentData({ endpoint, schema, fetchOptions: konfigurasjon?.fetchOptions })
    : null;

  return useSWR(endpoint, fetcher, lagSWRKonfigurasjon(konfigurasjon));
}

export function useSWRPost<SchemaType, Body extends Record<string, unknown>, FetchOptions = undefined>(
  endpoint: string | null,
  schema: ZodType<SchemaType>,
  body: Body | null,
  hentData: SWRHentData<SchemaType, Body, FetchOptions>,
  konfigurasjon?: SWRHookKonfigurasjon<FetchOptions>,
) {
  const cacheKey = body && endpoint ? [endpoint, JSON.stringify(body)] : null;
  const fetcher = () => {
    if (!endpoint || !body) return null;
    return hentData({
      endpoint,
      schema,
      body,
      fetchOptions: konfigurasjon?.fetchOptions,
    });
  };

  return useSWR(cacheKey, fetcher, lagSWRKonfigurasjon(konfigurasjon));
}

export function useSWRPut<SchemaType, Body extends Record<string, unknown>, FetchOptions = undefined>(
  endpoint: string | null,
  schema: ZodType<SchemaType>,
  body: Body | null,
  hentData: SWRHentData<SchemaType, Body, FetchOptions>,
  konfigurasjon?: SWRHookKonfigurasjon<FetchOptions>,
) {
  const cacheKey = body && endpoint ? [endpoint, 'PUT', JSON.stringify(body)] : null;
  const fetcher = () => {
    if (!endpoint || !body) return null;
    return hentData({
      endpoint,
      schema,
      body,
      fetchOptions: konfigurasjon?.fetchOptions,
    });
  };

  return useSWR(cacheKey, fetcher, lagSWRKonfigurasjon(konfigurasjon));
}