#!/usr/bin/env node
import { main } from './run.mjs';

main(['swipl', ...process.argv.slice(2)]);
