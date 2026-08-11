const { triple, namedNode } = require('@rdfjs/data-model');
const urlJoin = require('url-join');
const { PodResourcesHandlerMixin } = require('@activitypods/app');
const CONFIG = require('../config/config');

// Full IRIs: pair:ExperienceAssociation / pair:experienceSkill / pair:experienceGrade /
// pair:hasExperience live under the pair/ (slash) sub-namespace, not pair# (see the note in
// core.service.js). AS_URL is the ActivityStreams `url` property, used by the pod-provider to
// link a WebID to its (private) profile resource — see @activitypods pod-provider's
// `services/profiles/profile.ts`, `auth.registered` handler.
const PAIR_HAS_EXPERIENCE = 'http://virtual-assembly.org/ontologies/pair/hasExperience';
const AS_URL_KEYS = ['https://www.w3.org/ns/activitystreams#url', 'as:url', 'url'];

module.exports = {
  name: 'experience',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    // Hosted in our own shape repository until merged into shapes.activitypods.org (see
    // app.service.js for the same URI used in the access need).
    shapeTreeUri: urlJoin(CONFIG.CUSTOM_SHAPE_REPOSITORY_URL, 'shapetrees/pair/ExperienceAssociation')
  },
  methods: {
    async onCreate(ctx, resource, actorUri) {
      const resourceUri = resource.id || resource['@id'];

      // Skills are public by default (see the project plan): this avoids running a per-contact
      // sharing flow, and re-sharing it every time the user's contact list changes. Requires the
      // acl:Control access need declared in app.service.js for this shape tree.
      await ctx.call('pod-permissions.add', {
        uri: resourceUri,
        agentUri: 'http://xmlns.com/foaf/0.1/Agent',
        agentPredicate: 'acl:agentClass',
        mode: 'acl:Read',
        actorUri
      });

      // Let contacts discover this skill from the user's own (already contact-gated) profile,
      // instead of crawling a public index. Requires acl:Write on as:Profile (app.service.js).
      const profileUri = await this.getProfileUri(ctx, actorUri);
      if (profileUri) {
        await ctx.call('pod-resources.patch', {
          resourceUri: profileUri,
          triplesToAdd: [triple(namedNode(profileUri), namedNode(PAIR_HAS_EXPERIENCE), namedNode(resourceUri))],
          actorUri
        });
      } else {
        this.logger.warn(`Could not resolve the profile of ${actorUri}: skipping pair:hasExperience patch`);
      }
    },

    async getProfileUri(ctx, actorUri) {
      const { body: webIdDoc } = await ctx.call('pod-resources.get', { resourceUri: actorUri, actorUri });
      for (const key of AS_URL_KEYS) {
        if (webIdDoc?.[key]) {
          const value = webIdDoc[key];
          return typeof value === 'string' ? value : value.id || value['@id'];
        }
      }
      return undefined;
    }
  }
};
