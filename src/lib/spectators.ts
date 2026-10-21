export const SPECTATOR_LOGINS = ['mozg-work'];

export const isSpectatorLogin = (login?: string | null) =>
  !!login && SPECTATOR_LOGINS.includes(login.toLowerCase());
