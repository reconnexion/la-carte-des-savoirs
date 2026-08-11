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
          // Hosted in our own shape repository until merged into shapes.activitypods.org
          // (https://github.com/activitypods/shapes/pull/new/add-pair-experience-association).
          shapeTreeUri: urlJoin(CONFIG.CUSTOM_SHAPE_REPOSITORY_URL, 'shapetrees/pair/ExperienceAssociation'),
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
          // Read the user's home address, and (if they consent) make it publicly readable so it
          // can be shown on the map to their contacts.
          shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/vcard/Location'),
          accessMode: ['acl:Read', 'acl:Control']
        },
        'apods:ReadInbox',
        'apods:ReadOutbox',
        'apods:PostOutbox'
      ],
      optional: []
    },
    queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
  }
};
