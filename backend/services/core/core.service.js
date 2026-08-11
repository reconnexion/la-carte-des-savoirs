const path = require('path');
const { CoreService } = require('@semapps/core');
const { apods, notify, interop, oidc, skos, pair, schema } = require('@semapps/ontologies');
const CONFIG = require('../../config/config');

module.exports = {
  mixins: [CoreService],
  settings: {
    baseUrl: CONFIG.HOME_URL,
    baseDir: path.resolve(__dirname, '../..'),
    triplestore: {
      url: CONFIG.SPARQL_ENDPOINT,
      user: CONFIG.JENA_USER,
      password: CONFIG.JENA_PASSWORD,
      mainDataset: CONFIG.MAIN_DATASET
    },
    // Note: `pair:` (from @semapps/ontologies) is bound to the http://virtual-assembly.org/ontologies/pair#
    // namespace. The pair:ExperienceAssociation shape tree we use (and its experienceSkill/
    // experienceGrade/hasExperience properties, plus pair:Grade) actually live under the
    // http://virtual-assembly.org/ontologies/pair/ (slash) sub-namespace instead, so those are
    // always written as full IRIs in our services rather than "pair:" CURIEs.
    ontologies: [apods, notify, interop, oidc, skos, pair, schema],
    activitypub: {
      queueServiceUrl: CONFIG.QUEUE_SERVICE_URL
    },
    api: {
      port: CONFIG.PORT
    },
    ldp: {
      resourcesWithContainerPath: false
    },
    void: false,
    webid: false
  }
};
