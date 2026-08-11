const { PodActivitiesHandlerMixin } = require('@activitypods/app');

// Reacts to the frontend posting a custom "ShareLocation" activity to the user's own outbox
// (see frontend/src/pages/OnboardingPage.tsx) — the recommended pattern for a user-triggered
// server-side action that needs the caller's WebID (see docs/app-framework/backend/listening-to-inbox-and-outbox.md):
// there is no supported way for a third-party app backend to expose its own Bearer-token-verified
// HTTP endpoint, so the frontend signals intent through the user's own Pod instead.
module.exports = {
  name: 'sharing',
  mixins: [PodActivitiesHandlerMixin],
  activities: {
    shareLocation: {
      match: {
        type: 'ShareLocation'
      },
      async onEmit(ctx, activity, actorUri) {
        this.logger.info(`Received ShareLocation from ${actorUri}`);

        const profileUri = await this.getProfileUri(ctx, actorUri);
        if (!profileUri) {
          this.logger.warn(`Could not resolve the profile of ${actorUri}: skipping location sharing`);
          return;
        }

        const { body: profile } = await ctx.call('pod-resources.get', { resourceUri: profileUri, actorUri });
        const addressUri = profile?.['vcard:hasAddress']?.id || profile?.['vcard:hasAddress']?.['@id'] || profile?.['vcard:hasAddress'];
        if (!addressUri) {
          this.logger.warn(`${actorUri} has no address set yet: skipping location sharing`);
          return;
        }

        await ctx.call('pod-permissions.add', {
          uri: addressUri,
          agentUri: 'http://xmlns.com/foaf/0.1/Agent',
          agentPredicate: 'acl:agentClass',
          mode: 'acl:Read',
          actorUri
        });

        this.logger.info(`Made ${addressUri} publicly readable for ${actorUri}`);
      }
    }
  },
  methods: {
    // Duplicated from experience.service.js on purpose: these are two small, independent
    // services, and this whole method is 4 lines.
    async getProfileUri(ctx, actorUri) {
      const { body: webIdDoc } = await ctx.call('pod-resources.get', { resourceUri: actorUri, actorUri });
      for (const key of ['https://www.w3.org/ns/activitystreams#url', 'as:url', 'url']) {
        if (webIdDoc?.[key]) {
          const value = webIdDoc[key];
          return typeof value === 'string' ? value : value.id || value['@id'];
        }
      }
      return undefined;
    }
  }
};
