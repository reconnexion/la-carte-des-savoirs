const path = require('path');
const urlJoin = require('url-join');
const { ImporterMixin } = require('@semapps/importer');
const { MIME_TYPES } = require('@semapps/mime-types');
const CONFIG = require('../../config/config');

module.exports = {
  name: 'importers.skills-catalog',
  mixins: [ImporterMixin],
  // Without this, started() can fire before skills-catalog.service.js has finished creating the
  // /pair/skill container (its own started() hook), silently failing the first several imports.
  dependencies: ['skills-catalog'],
  settings: {
    source: {
      getAllFull: path.resolve(__dirname, `./data/skills-catalog-${CONFIG.APP_LANG}.json`),
      fieldsMapping: {
        slug: 'label'
      }
    },
    dest: {
      containerUri: urlJoin(CONFIG.HOME_URL, '/pair/skill')
    }
  },
  methods: {
    transform(data) {
      return {
        '@type': 'pair:Skill',
        'rdfs:label': data.label,
        // Flat, not nested under the container path: core.service.js sets
        // `ldp: { resourcesWithContainerPath: false }`, so every non-container resource's own
        // id is `{HOME_URL}{slug}` regardless of which container it was posted into.
        'skos:broader': data.parent ? urlJoin(CONFIG.HOME_URL, data.parent) : undefined
      };
    }
  },
  async started() {
    // This catalog is static (bundled in the repo, not synced from an external API), and
    // freshImport() has no notion of "update if changed" without a real getOneFull/apiUrl wired
    // up — every call just creates new resources, so re-running it on every restart produced
    // ever-growing duplicates (slug collisions get a numeric suffix rather than being reused).
    // Import once, only if the container is still empty.
    const container = await this.broker.call('ldp.container.get', {
      containerUri: this.settings.dest.containerUri,
      accept: MIME_TYPES.JSON,
      webId: 'system'
    });
    if (!container?.['ldp:contains']?.length) {
      await this.actions.freshImport({ clear: false });
    }
  }
};
