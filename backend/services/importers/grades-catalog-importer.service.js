const path = require('path');
const urlJoin = require('url-join');
const { ImporterMixin } = require('@semapps/importer');
const CONFIG = require('../../config/config');

module.exports = {
  name: 'importers.grades-catalog',
  mixins: [ImporterMixin],
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
        // Full IRI: pair:Grade lives under the pair/ (slash) sub-namespace, unlike pair:Skill
        // which is under pair# — the "pair" prefix registered in core.service.js is bound to
        // pair#, so a bare "pair:Grade" CURIE would resolve to the wrong URI here.
        '@type': 'http://virtual-assembly.org/ontologies/pair/Grade',
        'rdfs:label': data.label,
        'schema:position': data.position
      };
    }
  },
  async started() {
    await this.actions.freshImport({ clear: false });
  }
};
