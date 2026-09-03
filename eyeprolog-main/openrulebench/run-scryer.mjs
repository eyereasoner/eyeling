#!/usr/bin/env node
import { main } from './run.mjs';

main(['scryer', ...process.argv.slice(2)]);
