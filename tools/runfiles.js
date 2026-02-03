#!/usr/bin/env node
'use strict';

const { runFiles } = require('..');

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: node tools/runfiles.js <file1.n3> <file2.n3> ...');
  console.error('Example: node tools/runfiles.js examples/*.n3');
  process.exitCode = 1;
} else {
  process.exitCode = runFiles(files);
}
