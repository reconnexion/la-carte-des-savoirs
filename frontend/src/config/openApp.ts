// Same mechanism Welcome To My Place uses (see its useOpenExternalApp hook): every Pod exposes
// {webId}/openApp?type=...&uri=...&mode=..., which looks up whichever app is registered for that
// resource type and redirects there — for as:Profile specifically, that's always the Pod
// provider's own frontend itself, not some other ActivityPods app. It's scoped to the *viewer's*
// own Pod (their own DataGrants determine what's resolvable), not the target's.
export const openAppProfileUrl = (viewerWebId: string, profileUri: string): string => {
  const params = new URLSearchParams({ type: 'as:Profile', uri: profileUri, mode: 'show' });
  return `${viewerWebId.replace(/\/$/, '')}/openApp?${params.toString()}`;
};
