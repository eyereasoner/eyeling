#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const scripts = [
  "test:packlist",
  "test:api",
  "test:n3gen",
  "test:examples",
  "test:manifest",
  "test:playground",
  "test:package",
];

for (const s of scripts) {
  const r = spawnSync("npm", ["run", "-s", s], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

