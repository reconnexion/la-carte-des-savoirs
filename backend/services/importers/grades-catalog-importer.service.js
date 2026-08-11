const path = require('path');
const urlJoin = require('url-join');
const { ImporterMixin } = require('@semapps/importer');
const { MIME_TYPES } = require('@semapps/mime-types');
const CONFIG = require('../../config/config');

module.exports = {
  name: 'importers.grades-catalog',
  mixins: [ImporterMixin],
  // See skills-catalog-importer.service.js for why this is needed.
  dependencies: ['grades-catalog'],
  settings: {
    source: {
      getAllFull: path.resolve(__dirname, `./data/grades-catalog-${CONFIG.APP_LANG}.json`),
      fieldsMapping: {
        slug: 'label'
      }
    },
    dest: {
      containerUri: urlJoin(CONFIG.HOME_URL, '/pair/grade')
    }
  },
  methods: {
    transform(data) {
      return {
        '@type': 'pair:Grade',
        'rdfs:label': data.label,
        'schema:position': data.position
      };
    }
  },
  async started() {
    // See skills-catalog-importer.service.js for why this guard is needed: without it, every
    // backend restart creates a fresh set of duplicates (slug collisions get a numeric suffix
    // rather than being reused/updated).
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
