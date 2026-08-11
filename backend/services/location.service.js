const { triple, namedNode, literal } = require('@rdfjs/data-model');
const urlJoin = require('url-join');
const { PodResourcesHandlerMixin } = require('@activitypods/app');
const CONFIG = require('../config/config');

// Rather than making the whole vcard:Location (street address, postal code...) publicly
// readable, copy just the lat/lng onto the user's profile — already visible to contacts natively
// (no separate sharing step needed), and all a map pin needs anyway. Nudged by a small random
// offset for approximate rather than exact positioning, since the profile has a wider practical
// audience than the address itself. The Location resource itself stays private (default ACL):
// someone who separately has read access to it (e.g. a future access grant) still sees the real
// address, but this app never displays or requires that.
//
// The geo node is a stable named URI (`<profile>#geo`), not a blank node: unlike the frontend
// (which posts raw SPARQL Update text and has no reliable way to reference a previous request's
// blank node), this runs as an internal action that reads the old value back before patching, so
// a plain deterministic URI keeps DELETE/INSERT trivial across repeated edits.
const AS_URL_KEYS = ['https://www.w3.org/ns/activitystreams#url', 'as:url', 'url'];
const VCARD_HAS_GEO = 'http://www.w3.org/2006/vcard/ns#hasGeo';
const VCARD_LATITUDE = 'http://www.w3.org/2006/vcard/ns#latitude';
const VCARD_LONGITUDE = 'http://www.w3.org/2006/vcard/ns#longitude';
// ~500m at most, in either direction — enough to not pinpoint the exact building.
const JITTER_DEGREES = 0.005;

const asLiteral = value => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') return value['@value'];
  return value;
};

module.exports = {
  name: 'location',
  mixins: [PodResourcesHandlerMixin],
  settings: {
    shapeTreeUri: urlJoin(CONFIG.SHAPE_REPOSITORY_URL, 'shapetrees/vcard/Location')
  },
  methods: {
    async onCreate(ctx, resource, actorUri) {
      await this.syncProfileGeo(ctx, resource, actorUri);
    },
    async onUpdate(ctx, resource, actorUri) {
      await this.syncProfileGeo(ctx, resource, actorUri);
    },

    async syncProfileGeo(ctx, resource, actorUri) {
      const geo = resource?.['vcard:hasAddress']?.['vcard:hasGeo'];
      const lat = Number(asLiteral(geo?.['vcard:latitude']));
      const lng = Number(asLiteral(geo?.['vcard:longitude']));
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        this.logger.warn(`Location ${resource.id || resource['@id']} has no usable vcard:hasGeo yet`);
        return;
      }

      const profileUri = await this.getProfileUri(ctx, actorUri);
      if (!profileUri) {
        this.logger.warn(`Could not resolve the profile of ${actorUri}: skipping geo sync`);
        return;
      }

      const jitteredLat = lat + (Math.random() - 0.5) * JITTER_DEGREES;
      const jitteredLng = lng + (Math.random() - 0.5) * JITTER_DEGREES;
      const geoNodeUri = `${profileUri}#geo`;

      const { body: profile } = await ctx.call('pod-resources.get', { resourceUri: profileUri, actorUri });
      const oldGeo = profile?.['vcard:hasGeo'];
      const triplesToRemove = [];
      if (oldGeo) {
        const oldLat = asLiteral(oldGeo['vcard:latitude']);
        const oldLng = asLiteral(oldGeo['vcard:longitude']);
        if (oldLat !== undefined) triplesToRemove.push(triple(namedNode(geoNodeUri), namedNode(VCARD_LATITUDE), literal(String(oldLat))));
        if (oldLng !== undefined) triplesToRemove.push(triple(namedNode(geoNodeUri), namedNode(VCARD_LONGITUDE), literal(String(oldLng))));
      }

      await ctx.call('pod-resources.patch', {
        resourceUri: profileUri,
        triplesToRemove,
        triplesToAdd: [
          // Harmless no-op to re-add if already present (patch adds are idempotent).
          triple(namedNode(profileUri), namedNode(VCARD_HAS_GEO), namedNode(geoNodeUri)),
          triple(namedNode(geoNodeUri), namedNode(VCARD_LATITUDE), literal(String(jitteredLat))),
          triple(namedNode(geoNodeUri), namedNode(VCARD_LONGITUDE), literal(String(jitteredLng)))
        ],
        actorUri
      });
    },

    // Duplicated from experience.service.js on purpose: these are two small, independent
    // services, and this whole method is 4 lines.
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
