#!/usr/bin/env node
import { main } from './run.mjs';

main(['eyeprolog', ...process.argv.slice(2)]);
