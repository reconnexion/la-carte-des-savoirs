const { ControlledContainerMixin } = require('@semapps/ldp');

// Public catalog of the 4 pair:Grade levels (Débutant, Intermédiaire, Confirmé, Expert). Same
// pattern as skills-catalog.service.js, just a flat list instead of a 2-level tree.
module.exports = {
  name: 'grades-catalog',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/pair/grade',
    // Full IRI: pair:Grade lives under the pair/ (slash) sub-namespace, not pair# (see note in
    // importers/grades-catalog-importer.service.js).
    acceptedTypes: ['http://virtual-assembly.org/ontologies/pair/Grade'],
    permissions: {
      anon: {
        read: true
      },
      anyUser: {
        write: true
      }
    },
    newResourcesPermissions: webId => ({
      anon: {
        read: true
      },
      user: {
        uri: webId,
        write: true,
        control: true
      }
    })
  }
};
