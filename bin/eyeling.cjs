#!/usr/bin/env node
'use strict';

const bundle = require('../eyeling.js');

if (!bundle || typeof bundle.main !== 'function') {
  throw new Error('Eyeling CLI bundle did not expose main()');
}

bundle.main();
