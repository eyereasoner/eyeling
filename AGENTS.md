# Working on eyeling

eyeling is a JavaScript reasoner for Notation3 (N3). It derives conclusions
from facts and rules, writes N3 proofs, and checks those proofs; it runs as a
command-line program, a Node.js library, and a browser application. Describe
what it implements as it currently is, distinguish demonstrated behavior from
design goals, and keep error messages specific and user-facing text direct.

## Repository map

- `lib/`: source modules.
  - `lexer.js`, `parser.js`: N3, Turtle/TriG, N-Triples/N-Quads, and RDF
    Message Log parsing.
  - `engine.js`: forward and backward reasoning, unification (including
    quoted graphs), and fuses. `rules.js`, `store.js`, `fast_rdf.js`,
    `multisource.js` support it.
  - `builtins.js`: built-ins; `eyeling-builtins.ttl` catalogs them in RDF.
  - `explain.js`, `trace.js`, `check-proof.js`: proof output and checking.
  - `printing.js`, `rdfjs.js`, `skolem.js`, `time.js`, `deref.js`.
  - `cli.js`: CLI. `entry.js`, `prelude.js`: bundle entry points.
- `index.js`, `index.d.ts`, `browser.d.ts`: Node API and declarations.
- `eyeling.js` and `dist/browser/`: committed bundles built from `lib/` by
  `tools/bundle.js`. `bin/eyeling.cjs` runs `eyeling.js`, and `index.js`
  uses both the bundle and `lib/`, so rebuild after every change to `lib/`
  or the CLI and the API can disagree.
- `playground.html`: browser playground; `demo.html`: small demo.
- `examples/*.n3`: runnable examples. `examples/output/` holds output goldens
  (`.n3`, or `.md` for report-style output), `examples/proof/` proof goldens,
  `examples/input/` companion inputs (`.trig`) loaded with the example of the
  same stem, `examples/builtin/` custom built-ins (`.js`) loaded with the
  example of the same stem, and `examples/deck/` Markdown walkthroughs.
- `test/`: `run.js` runs every suite in order. `api.test.js` holds focused
  behavior and regression cases; `examples.test.js` compares examples (and,
  with `--proof-only`, proofs) to their goldens; `check_proof.test.js` checks
  the packaged proofs; `fixtures/` holds test inputs. `manifest.test.js` runs
  the Notation3 conformance suite from `notation3tests/tests/`, and
  `rdf12.test.js` the W3C RDF 1.2 syntax suites from `w3c_rdf/rdf-tests/`.
  Both mirrors are committed and local-only; `npm run sync:test-suites`
  (`tools/sync-test-suites.js`) refreshes them.
- `README.md`: user and maintainer guide. `notes/`: design notes.
- `release`, `.github/workflows/`: releases, Pages, npm publishing, GitHub
  releases, and RDF 1.2 compliance.

## Commands

```sh
npm install
npm run build                                # rebuild eyeling.js and dist/
node bin/eyeling.cjs examples/socrates.n3
node bin/eyeling.cjs -p examples/socrates.n3 # proof
npm run test:api
npm run test:examples
npm test                                     # build, then every suite
npm run sync:test-suites                     # refresh conformance mirrors
npx eslint .
git diff --check
```

`npm test` takes a few minutes. The conformance suites read only their
mirrors; sync them deliberately and review the diff rather than letting an
upstream change arrive mid-run. Large examples
such as the deep taxonomies produce large output and proofs; redirect them to
a temporary file and inspect focused parts rather than flooding the terminal.

## Language and examples

- Graph terms are compared as sets: a pattern matches a quoted graph when its
  substitution yields the same set, even by merging statements, so
  `{ ?x :p :c . :a :p :c }` matches `{ :a :p :c }` with `?x = :a`.
- Graph terms are opaque and keep literal lexical identity: inside a quoted
  graph `"01"^^xsd:integer` is not `1`, while the shorthand `1` is
  `"1"^^xsd:integer`. Numeric matching outside graph terms compares values.
- Every example starts with a short comment block saying what situation it
  models and what eyeling derives. Describe the example as it is; do not
  mention where it came from.
- Every checked example has an output golden. The examples suite only reads
  goldens: after an intentional output change, regenerate the golden from
  the CLI output and review the diff. No golden should change unless
  intended.

## Implementation and verification

Match the surrounding JavaScript: its naming, comment density, and comments
that say why. Prefer small, direct changes over new machinery, and fix the
code that produces a wrong result rather than patching its output.

Proof checking must stay sound: a forged proof must never be reported as
checked.

eyeling, eyeron, eyeleng, and eyeprolog are one family; a behavior fixed in
one usually belongs in the others. eyeron's `SPEC.md` is the most detailed
statement of the shared N3 semantics. When eyeling and eyeron disagree, find
out which one is right before changing either. eyeron is expected to run
about as fast as eyeling, so a slowdown here moves the bar for both: time the
examples suite before and after engine changes, on a quiet machine.

Run focused tests while working, then `npm test` and eslint before finishing
code changes. Add a regression case to `test/api.test.js` for each behavior
change, numbered after the last one. Documentation describes the current
behavior, not how it came to be.

## Versions and releases

Commit directly to `main`. Do not use closing keywords such as `Fixes #N` in
commit messages; issues are closed by hand. Follow the user's instructions
about committing, pushing, and releasing.

`package.json` is the version source; never bump it by hand. Releases are cut
with the release script after `npm test` has passed:

```sh
./release patch "<release message>"
./release minor "<release message>"
./release major "<release message>"
```

The script switches to `main`, pulls with `--ff-only`, bumps the version with
`npm version`, stages every change, commits, creates an annotated `v*` tag,
and pushes the branch and tag. Review the working tree first because it
stages everything. A push to `main` deploys GitHub Pages; a `v*` tag creates
the GitHub release and publishes the package to npm.
