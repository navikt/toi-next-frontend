import { backendLogger } from '@navikt/next-logger';

type NextLoggerConfig = {
  logger: unknown;
};

export const nextLoggerConfig: NextLoggerConfig = {
  logger: backendLogger,
};

export default nextLoggerConfig;
