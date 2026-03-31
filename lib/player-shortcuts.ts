let activePlayerToken: symbol | null = null;

export function setActivePlayerToken(token: symbol) {
  activePlayerToken = token;
}

export function isActivePlayerToken(token: symbol) {
  return activePlayerToken === token;
}

export function clearActivePlayerToken(token: symbol) {
  if (activePlayerToken === token) {
    activePlayerToken = null;
  }
}
