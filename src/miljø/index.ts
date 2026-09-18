export const erTestmodus = () =>
  process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_MODE === 'true';

export const erLokalt = () => process.env.NEXT_PUBLIC_DEVELOPER === 'local';

export const skalMocke = () => erLokalt() || erTestmodus();
