const path = require('path');
const urlJoin = require('url-join');
const { ImporterMixin } = require('@semapps/importer');
const CONFIG = require('../../config/config');

module.exports = {
  name: 'importers.skills-catalog',
  mixins: [ImporterMixin],
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
        'skos:broader': data.parent ? urlJoin(CONFIG.HOME_URL, 'pair/skill', data.parent) : undefined
      };
    }
  },
  async started() {
    // Keep the catalog in sync with skills-catalog-fr.json on every start (cheap: importOne
    // skips resources whose dc:modified hasn't changed).
    await this.actions.freshImport({ clear: false });
  }
};
