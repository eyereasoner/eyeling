#!/usr/bin/env node
'use strict';

import('./cli.mjs').then(({ main }) => main(process.argv.slice(2))).catch((error) => {
  console.error(`eyelang: ${error && error.message ? error.message : String(error)}`);
  process.exit(1);
});
