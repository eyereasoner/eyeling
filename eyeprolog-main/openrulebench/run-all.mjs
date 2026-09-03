#!/usr/bin/env node
import { main } from './run.mjs';

main(['all', ...process.argv.slice(2)]);
