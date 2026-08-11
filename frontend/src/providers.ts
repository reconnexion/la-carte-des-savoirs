import { authProvider as apAuthProvider, dataProvider as apDataProvider } from '@activitypods/refine-providers';

/**
 * The URI that identifies this application (its client_id). Served by our own backend
 * (see backend/services/app.service.js, AppService) rather than as a static frontend file,
 * since we need a backend anyway (custom shapes, skills/grades catalogs).
 */
export const CLIENT_ID = import.meta.env.VITE_BACKEND_CLIENT_ID as string;

/** When set, the login page offers this single Pod provider instead of the public list. */
export const DEFAULT_POD_PROVIDER = import.meta.env.VITE_POD_PROVIDER_BASE_URL as string | undefined;

const SHAPE_REPOSITORY_URL = import.meta.env.VITE_SHAPE_REPOSITORY_URL as string;

export const authProvider = apAuthProvider({
  clientId: CLIENT_ID
});

export const dataProvider = apDataProvider({
  authProvider,
  resources: {
    // A declared skill: pair:ExperienceAssociation.
    experiences: {
      shapeTreeUri: `${SHAPE_REPOSITORY_URL}shapetrees/pair/ExperienceAssociation`
    },
    // The connected user's own profile, and (via getList) every profile they can currently read
    // (themselves + their contacts, natively enforced by the Pod provider).
    profile: {
      shapeTreeUri: `${SHAPE_REPOSITORY_URL}shapetrees/as/Profile`
    },
    location: {
      shapeTreeUri: `${SHAPE_REPOSITORY_URL}shapetrees/vcard/Location`
    }
  }
});
