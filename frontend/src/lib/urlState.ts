export interface URLState {
  sessionId?: string;
  policy?: string;
  attackType?: string;
  tab?: string;
}

export function encodeState(state: URLState): string {
  const parts: string[] = [];
  if (state.sessionId) parts.push(`s=${encodeURIComponent(state.sessionId)}`);
  if (state.policy) parts.push(`p=${encodeURIComponent(state.policy)}`);
  if (state.attackType) parts.push(`a=${encodeURIComponent(state.attackType)}`);
  if (state.tab) parts.push(`tab=${encodeURIComponent(state.tab)}`);
  return parts.join('&');
}

export function decodeState(): URLState {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const state: URLState = {};
  const s = params.get('s');
  const p = params.get('p');
  const a = params.get('a');
  const tab = params.get('tab');
  if (s) state.sessionId = decodeURIComponent(s);
  if (p) state.policy = decodeURIComponent(p);
  if (a) state.attackType = decodeURIComponent(a);
  if (tab) state.tab = decodeURIComponent(tab);
  return state;
}

export function updateState(updates: Partial<URLState>): void {
  const current = decodeState();
  const next = { ...current, ...updates };
  // Remove undefined keys
  (Object.keys(next) as (keyof URLState)[]).forEach((k) => {
    if (next[k] === undefined) delete next[k];
  });
  const encoded = encodeState(next);
  window.location.hash = encoded ? `#${encoded}` : '';
}
