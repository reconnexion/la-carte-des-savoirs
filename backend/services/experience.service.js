// @rdfjs/data-model v2 is ESM-only: under require(), its exports land under `.default` (CJS
// interop) as a DataFactory *instance*, and the factory method is `quad` (not the old RDF/JS
// `triple` alias). `quad` reads `this` internally (for its default `graph` argument), so it can't
// be destructured off the instance like `namedNode` (which doesn't) — call it as `rdf.quad(...)`.
const rdf = require('@rdfjs/data-model').default;
const { namedNode } = rdf;
const urlJoin = require('url-join');
const { PodResourcesHandlerMixin } = require('@activitypods/app');
const CONFIG = require('../config/config');

// Full IRIs: pair:ExperienceAssociation / pair:experienceSkill / pair:experienceGrade /
// pair:hasExperience are published under pair# here (not the upstream ontology's own pair/
// sub-namespace) — see the note in activitypods-shapes' ExperienceAssociation shape/shapetree
// for why (pair/ isn't registered anywhere the Pod provider can resolve it, which made app
// registration fail with "Could not register ontology for resource type ..."). AS_URL is the
// ActivityStreams `url` property, used by the pod-provider to link a WebID to its (private)
// profile resource — see @activitypods pod-provider's `services/profiles/profile.ts`,
// `auth.registered` handler.
const PAIR_HAS_EXPERIENCE = 'http://virtual-assembly.org/ontologies/pair#hasExperience';
const AS_URL_KEYS = ['https://www.w3.org/ns/activitystreams#url', 'as:url', 'url'];

module.exports = {
  name: 'experience',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    // See app.service.js for the same URI used in the access need.
    shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/pair/ExperienceAssociation')
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
          triplesToAdd: [rdf.quad(namedNode(profileUri), namedNode(PAIR_HAS_EXPERIENCE), namedNode(resourceUri))],
          actorUri
        });
      } else {
        this.logger.warn(`Could not resolve the profile of ${actorUri}: skipping pair:hasExperience patch`);
      }
    },

    async onDelete(ctx, resource, actorUri) {
      const resourceUri = resource.id || resource['@id'];

      const profileUri = await this.getProfileUri(ctx, actorUri);
      if (profileUri) {
        await ctx.call('pod-resources.patch', {
          resourceUri: profileUri,
          triplesToRemove: [rdf.quad(namedNode(profileUri), namedNode(PAIR_HAS_EXPERIENCE), namedNode(resourceUri))],
          actorUri
        });
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
