// @rdfjs/data-model v2 is ESM-only: under require(), quad/namedNode live under .default, and
// quad reads `this` internally for its default graph argument, so it can't be destructured off
// the instance like namedNode can (see experience.service.js for the same note in more detail).
const rdf = require('@rdfjs/data-model').default;
const { namedNode } = rdf;
const { PodActivitiesHandlerMixin } = require('@activitypods/app');

// Full IRI, not the apods: CURIE: this is sent directly in the outbox POST body from the
// frontend (see EndorseDialog.tsx), where there's no guarantee the "apods" prefix is mapped in
// whatever @context happens to be in scope. Matching here uses the compacted form instead
// (see the `match` below) because that's what the Pod provider's own dereferencing produces
// when handing the activity to matchActivity() — see @activitypods/app's shape-tree-fetcher.js:
// "we need to compact the types, because matchActivity doesn't handle full URIs".
const APODS_RECOMMENDED_BY = 'http://activitypods.org/ns/core#recommendedBy';

const PAIR_EXPERIENCE_SKILL = ['http://virtual-assembly.org/ontologies/pair#experienceSkill', 'pair:experienceSkill'];
const RDFS_LABEL = ['http://www.w3.org/2000/01/rdf-schema#label', 'rdfs:label'];

const asId = value => {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id || value['@id'];
};

const firstOf = (record, keys) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const asLiteral = value => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'object' ? value['@value'] : value;
};

// Mastodon-style acct handle, same convention (and same formatUsername logic) as the ActivityPods
// Pod provider's own frontend uses for its /network/:webfingerId route — see
// pod-provider/frontend/src/utils.ts's formatUsername. Our own frontend's /user/:handle route
// (see App.tsx) parses this back into a WebID to open that profile's panel.
const webIdToHandle = webId => {
  const url = new URL(webId);
  const username = url.pathname.split('/')[1];
  return `@${username}@${url.host}`;
};

module.exports = {
  name: 'endorsement',
  mixins: [PodActivitiesHandlerMixin],
  dependencies: ['pod-resources', 'pod-notifications'],
  activities: {
    endorse: {
      match: {
        type: 'apods:Endorse'
      },
      // No onEmit here: granting read access matching to/cc on the newly-posted activity has to
      // happen on the *frontend*, using the sender's own fully-privileged Solid session (see
      // EndorseDialog.tsx) — not from here. A backend-side pod-permissions.add call is signed as
      // *the app*, not as the pod owner, and our app was never granted acl:Control over Activity
      // resources in the first place (unlike pair:ExperienceAssociation, which has a real SAI
      // DataGrant backing that acl:Control; Activities aren't shape-tree/DataGrant-governed
      // resources at all, since they're posted through /outbox rather than a DataGrant-resolved
      // container). Confirmed live: the app-proxied ACL PATCH itself 403'd.
      async onReceive(ctx, activity, actorUri) {
        // actorUri is whoever's inbox this landed in — the person whose skill is being
        // recommended, or someone they were explicitly cc'd in to let them know about it. Only
        // the actual skill owner gets the apods:recommendedBy link added to their
        // ExperienceAssociation: for a cc'd bystander this resource isn't in their own Pod at all,
        // so the patch below fails for them and is skipped — that's the expected, correct outcome,
        // not an error worth surfacing.
        const experienceUri = asId(activity.object);
        if (experienceUri) {
          try {
            await ctx.call('pod-resources.patch', {
              resourceUri: experienceUri,
              triplesToAdd: [rdf.quad(namedNode(experienceUri), namedNode(APODS_RECOMMENDED_BY), namedNode(activity.id))],
              actorUri
            });
          } catch (e) {
            this.logger.info(
              `${actorUri} doesn't own ${experienceUri}, skipping the recommendedBy link (likely a cc'd contact being informed, not the skill owner)`
            );
          }
        } else {
          this.logger.warn(`Received an Endorse activity ${activity.id} with no usable object URI`);
        }

        // Best-effort: the skill (public by design, see experience.service.js) is fetched again
        // here purely to put its name in the notification title — a missing/unreadable skill
        // shouldn't block the notification itself, just fall back to a generic title.
        const skillLabel = experienceUri ? await this.getSkillLabel(ctx, experienceUri, actorUri) : undefined;

        // Same notification mechanism as any other ActivityPods app — see
        // https://docs.activitypods.org/app-framework/backend/sending-notifications/
        await ctx.call('pod-notifications.send', {
          template: {
            title: {
              fr: '{{#if skillLabel}}{{emitterProfile.vcard:given-name}} a recommandé votre compétence « {{skillLabel}} »{{else}}{{emitterProfile.vcard:given-name}} a recommandé une de vos compétences{{/if}}',
              en: '{{#if skillLabel}}{{emitterProfile.vcard:given-name}} recommended your skill "{{skillLabel}}"{{else}}{{emitterProfile.vcard:given-name}} recommended one of your skills{{/if}}'
            },
            content: '{{activity.content}}',
            actions: [
              {
                caption: { fr: 'Voir', en: 'View' },
                // Links to the recipient's own profile — the skill being recommended is theirs,
                // so unlike the recommender it's guaranteed to actually show up in their own
                // network view (has at least this one skill) rather than potentially being
                // someone with no declared skills of their own at all.
                // No encodeURIComponent: @ and : are both valid unencoded in a URL path segment
                // (RFC 3986's pchar grammar), and it keeps the link looking like the handle
                // itself rather than /user/%40test3%40localhost%3A3000.
                link: `/user/${webIdToHandle(actorUri)}`
              }
            ]
          },
          activity,
          skillLabel,
          recipientUri: actorUri,
          context: activity.id
        });
      }
    },
    // Lets a recommender retract their own recommendation (see SkillCard.tsx's delete button) —
    // standard AS2 Undo, referencing the original Endorse activity's URI as its object. The
    // `object: {type: 'apods:Endorse'}` matcher makes matchActivity dereference that URI (needs
    // the same apods:Endorse acl:Read access need as the plain endorse handler above), so by the
    // time this runs, `activity.object` is the *full* original Endorse activity, not just its URI.
    undoEndorse: {
      match: {
        type: 'Undo',
        object: {
          type: 'apods:Endorse'
        }
      },
      async onReceive(ctx, activity, actorUri) {
        const endorseActivity = activity.object;
        const experienceUri = asId(endorseActivity?.object);
        const endorseUri = endorseActivity?.id || endorseActivity?.['@id'];
        if (experienceUri && endorseUri) {
          try {
            await ctx.call('pod-resources.patch', {
              resourceUri: experienceUri,
              triplesToRemove: [rdf.quad(namedNode(experienceUri), namedNode(APODS_RECOMMENDED_BY), namedNode(endorseUri))],
              actorUri
            });
          } catch (e) {
            this.logger.info(
              `${actorUri} doesn't own ${experienceUri}, skipping the recommendedBy removal (likely a cc'd contact, not the skill owner)`
            );
          }
        } else {
          this.logger.warn(`Received an Undo of Endorse activity ${activity.id} but couldn't resolve the underlying URIs`);
        }
      }
    }
  },
  methods: {
    async getSkillLabel(ctx, experienceUri, actorUri) {
      try {
        const { body: experience } = await ctx.call('pod-resources.get', { resourceUri: experienceUri, actorUri });
        const skillUri = asId(firstOf(experience, PAIR_EXPERIENCE_SKILL));
        if (!skillUri) return undefined;
        // Skills are public by design (see experience.service.js), so a plain fetch works
        // regardless of whether actorUri actually owns the experience (e.g. a cc'd bystander).
        const response = await fetch(skillUri, { headers: { Accept: 'application/ld+json' } });
        if (!response.ok) return undefined;
        const body = await response.json();
        const skill = Array.isArray(body) ? body[0] : body;
        return asLiteral(firstOf(skill, RDFS_LABEL));
      } catch (e) {
        this.logger.info(`Could not resolve the skill label for ${experienceUri}: ${e.message}`);
        return undefined;
      }
    }
  }
};
