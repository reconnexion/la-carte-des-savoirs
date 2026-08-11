const { ControlledContainerMixin } = require('@semapps/ldp');

// Public catalog of the 4 pair:Grade levels (Débutant, Intermédiaire, Confirmé, Expert). Same
// pattern as skills-catalog.service.js, just a flat list instead of a 2-level tree.
module.exports = {
  name: 'grades-catalog',
  mixins: [ControlledContainerMixin],
  settings: {
    path: '/pair/grade',
    acceptedTypes: ['pair:Grade'],
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
