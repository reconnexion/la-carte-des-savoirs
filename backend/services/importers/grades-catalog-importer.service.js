const path = require('path');
const urlJoin = require('url-join');
const { ImporterMixin } = require('@semapps/importer');
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
    await this.actions.freshImport({ clear: false });
  }
};
