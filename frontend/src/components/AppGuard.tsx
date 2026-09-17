import type { ReactNode } from 'react';
import { AntdBackgroundChecks } from '@activitypods/refine-providers/antd-background-checks';

import { useOwnActor } from '../hooks/useOwnActor';
import { authProvider } from '../providers';

/** Wraps every authenticated route in `AntdBackgroundChecks`, which refuses to render the app
 *  while the backend is offline, sends the user back through the consent screen when the app's
 *  access needs changed, and checks the backend is listening to the user's inbox (the only box
 *  it reacts to: `endorsement.service.js` handles recommendations landing there via
 *  `onReceive`). */
const AppGuard = ({ children }: { children: ReactNode }) => {
  const { data: ownActor } = useOwnActor();

  // `listeningTo` is empty until the actor document is loaded; the checks re-run once it is.
  const listeningTo = [ownActor?.inbox].filter((uri): uri is string => !!uri);

  return (
    <AntdBackgroundChecks authProvider={authProvider} listeningTo={listeningTo}>
      {children}
    </AntdBackgroundChecks>
  );
};

export default AppGuard;
