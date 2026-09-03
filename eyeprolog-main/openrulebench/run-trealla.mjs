#!/usr/bin/env node
import { main } from './run.mjs';

main(['trealla', ...process.argv.slice(2)]);
