const urlJoin = require('url-join');
const { AppService } = require('@activitypods/app');
const CONFIG = require('../config/config');

// For documentation, see: https://docs.activitypods.org/app-framework/backend/application-registration/
module.exports = {
  mixins: [AppService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    app: {
      name: CONFIG.APP_NAME,
      description: CONFIG.APP_DESCRIPTION,
      thumbnail: urlJoin(CONFIG.FRONT_URL, 'logo192.png'),
      frontUrl: CONFIG.FRONT_URL,
      supportedLocales: CONFIG.APP_LANG
    },
    oidc: {
      clientUri: CONFIG.FRONT_URL,
      redirectUris: urlJoin(CONFIG.FRONT_URL, 'login'),
      postLogoutRedirectUris: urlJoin(CONFIG.FRONT_URL, 'login?logout=true'),
      tosUri: null
    },
    accessNeeds: {
      required: [
        {
          // Declares what a user creates when they add a skill to the map.
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/pair/ExperienceAssociation'),
          // acl:Control is required so we can make new skills publicly readable (see
          // experience.service.js) instead of running a per-contact sharing flow.
          accessMode: ['acl:Read', 'acl:Write', 'acl:Control']
        },
        {
          // Read the user's own profile, and patch it with pair:hasExperience links so contacts
          // can discover their skills (see experience.service.js).
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/as/Profile'),
          accessMode: ['acl:Read', 'acl:Write']
        },
        {
          // Read/create/update the user's home address (added or edited directly from
          // onboarding/profile, see AddressEditor). The Location resource itself stays private, and
          // vcard:hasGeo is computed and copied onto the profile natively by the Pod provider (its
          // `before.put` hook on the profile container) as soon as the profile is PUT with
          // vcard:hasAddress set — no acl:Control needed here, no app-side code required at all.
          // (Location is a container flagged `excludeFromMirror` on the Pod provider, so it never
          // emits an AS2 activity — an onCreate/onUpdate-hook approach here would structurally never
          // fire, which is why this isn't handled the same way as pair:hasExperience below.)
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/vcard/Location'),
          accessMode: ['acl:Read', 'acl:Write']
        },
        // Required for PodResourcesHandlerMixin's onCreate hook to fire at all (see
        // experience.service.js, which makes new skills publicly readable and links them from the
        // profile): it's wired through pod-activities-watcher, which only listens to a user's
        // outbox once the app holds this special right. Confirmed via direct triplestore
        // inspection: without it, skill resources were created but stayed 403 forever, and
        // pair:hasExperience was never added to the profile.
        'apods:ReadOutbox'
      ],
      optional: []
    },
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  }
};
