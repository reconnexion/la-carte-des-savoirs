// Mastodon-style acct handle, matching the ActivityPods Pod provider frontend's own convention
// (pod-provider/frontend/src/utils.ts's formatUsername / useWebfingerId) — see
// backend/services/endorsement.service.js's webIdToHandle for the encoding half of this.
//
// A real implementation would resolve this via a genuine WebFinger lookup
// (GET {protocol}://{host}/.well-known/webfinger?resource=acct:{user}@{host}), same as the
// ActivityPods frontend's useWebfinger hook. This app only ever deep-links to its own Pod
// provider's own users (no cross-instance federation to support yet), so a plain URL
// reconstruction is enough and avoids the extra round trip — localhost is assumed http (dev),
// anything else https (the only two cases this app's own deployments actually use).
const HANDLE_RE = /^@([^@]+)@(.+)$/;

export const parseHandle = (handle: string): string | undefined => {
  const match = HANDLE_RE.exec(handle);
  if (!match) return undefined;
  const [, username, host] = match;
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/${username}`;
};

// Mirrors backend/services/endorsement.service.js's webIdToHandle — used here to build the /user/
// URL when selecting a member (marker click), so it round-trips through the same encoding either
// direction.
export const webIdToHandle = (webId: string): string => {
  const url = new URL(webId);
  const username = url.pathname.split('/')[1];
  return `@${username}@${url.host}`;
};

// No encodeURIComponent needed: @ and : are both valid unencoded in a URL path segment (RFC 3986's
// pchar grammar explicitly allows them), and react-router's useParams() captures the whole segment
// either way — this just keeps the address bar looking like the handle itself, e.g.
// /user/@test3@localhost:3000 rather than /user/%40test3%40localhost%3A3000.
export const userProfilePath = (webId: string): string => `/user/${webIdToHandle(webId)}`;
