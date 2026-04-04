'use strict';

module.exports = {
  register(api) {
    api.registerBuiltin('http://example.org/test#ok-register', ({ subst }) => [subst]);
  },
};
