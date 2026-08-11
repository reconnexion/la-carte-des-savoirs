const { ControlledContainerMixin } = require('@semapps/ldp');

// Public catalog of pair:Skill resources (categories + precise skills), organized as a 2-level
// tree via skos:broader. Not a Pod resource: hosted directly by our own backend, seeded at
// startup by importers/skills-catalog-importer.service.js. See the "La Carte des Savoirs" plan
// for why this reuses pair:Skill for both categories and precise skills.
module.exports = {
  name: 'skills-catalog',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/pair/skill',
    acceptedTypes: ['pair:Skill'],
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
