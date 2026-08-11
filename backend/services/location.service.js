const urlJoin = require('url-join');
const { PodResourcesHandlerMixin } = require('@activitypods/app');
const CONFIG = require('../config/config');

// Makes a user's vcard:Location publicly readable as soon as they create (or edit) it, exactly
// like experience.service.js does for skills — no separate "share" ceremony. We tried a
// consent-then-share flow via a custom outbox activity first (a service listening for it, calling
// pod-permissions.add) and it added real complexity for no benefit: the app already has full
// rights to do this the moment the user creates the resource, same as skills. The actual consent
// now happens once, up front, in the UI (see AddressEditor) — the user simply can't add an
// address until they've agreed it becomes visible to contacts.
module.exports = {
  name: 'location',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/vcard/Location')
  },
  methods: {
    async onCreate(ctx, resource, actorUri) {
      await this.makePublic(ctx, resource, actorUri);
    },
    async onUpdate(ctx, resource, actorUri) {
      await this.makePublic(ctx, resource, actorUri);
    },
    async makePublic(ctx, resource, actorUri) {
      const resourceUri = resource.id || resource['@id'];
      // Requires the acl:Control access need declared in app.service.js for this shape tree.
      // Idempotent: re-adding a permission the resource already has is a harmless no-op, so
      // calling this on every update (not just creation) is fine.
      await ctx.call('pod-permissions.add', {
        uri: resourceUri,
        agentUri: 'http://xmlns.com/foaf/0.1/Agent',
        agentPredicate: 'acl:agentClass',
        mode: 'acl:Read',
        actorUri
      });
    }
  }
};
