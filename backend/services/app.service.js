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
      thumbnail: urlJoin(CONFIG.FRONT_URL, 'favicon.svg'),
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
        'apods:ReadOutbox',
        // Recommendations (see endorsement.service.js): ReadInbox lets our backend watch the
        // *recommended person's* inbox for an apods:Endorse activity landing in it, so it can link
        // it from their ExperienceAssociation and trigger a notification. PostOutbox turned out to
        // still be required even though EndorseDialog.tsx posts using the sender's own Solid-OIDC
        // session, not an explicit app-signed proxy call: activitypub.outbox.post's own "is this
        // the pod owner posting to their own outbox" bypass didn't take effect for this request in
        // practice (confirmed live: removing PostOutbox produced a bare 403 on that POST, logged
        // with no further detail — consistent with AppControlMiddleware's
        // apods:PostOutbox-required branch, though the exact reason ctx.meta.webId didn't match
        // podOwner here isn't fully understood yet).
        'apods:ReadInbox',
        'apods:PostOutbox',
        {
          // acl:Read is needed for our backend's own dereferencing of an Endorse activity (via
          // pod-activities-watcher, proxied through the app) to be let through
          // AppControlMiddleware's type allow-list — without this, that proxied GET 403s even
          // though the activity's actual ACL (set automatically by the Pod provider's own
          // setRightsHandler, matching the activity's to/cc) is already correct. Confirmed live.
          // acl:Write is kept too in case the send path ends up going through
          // AppControlMiddleware's app-acting-on-behalf-of-user branch after all (see the
          // apods:PostOutbox note above) — harmless if unused.
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/apods/Endorse'),
          accessMode: ['acl:Read', 'acl:Write']
        },
        {
          // "Contacter" button (see ContactDialog.tsx): sends a plain as:Note, which
          // activitypub.object.wrap auto-wraps into a Create — the Pod provider's own native
          // contacts.message service (not anything of ours) then handles adding the recipient to
          // the sender's contacts WebACL group and emailing them, exactly like the messaging
          // already built into the Pod provider frontend/Arena. No app-specific backend service
          // needed for this at all.
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/as/Note'),
          accessMode: ['acl:Read', 'acl:Write']
        }
      ],
      optional: []
    },
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  }
};
