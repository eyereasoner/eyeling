// Command-line interface for eyelang.
// It loads programs from files, URLs, or stdin, then materializes derived output predicates.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

let engineModule = null;
let explanationModule = null;

export async function main(argv) {
  if (argv.length === 0) {
    await usage(process.stdout);
    return;
  }

  const options = {
    files: [],
    proof: false,
    stats: false,
    version: false,
    inputFormat: 'auto',
  };

  let endOptions = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!endOptions && arg === '--') {
      endOptions = true;
    } else if (!endOptions && (arg === '--version' || arg === '-v')) {
      options.version = true;
    } else if (!endOptions && (arg === '--help' || arg === '-h')) {
      await usage(process.stdout);
      return;
    } else if (!endOptions && (arg === '--proof' || arg === '-p')) {
      options.proof = true;
    } else if (!endOptions && (arg === '--stats' || arg === '-s')) {
      options.stats = true;
    } else if (!endOptions && (arg === '--rdf' || arg === '--rdf12')) {
      options.inputFormat = 'rdf12';
    } else if (!endOptions && arg === '--n3') {
      options.inputFormat = 'n3';
    } else if (!endOptions && arg === '--input-format') {
      const value = argv[++i];
      if (!value) throw new Error('--input-format needs a value');
      options.inputFormat = value;
    } else if (!endOptions && arg.startsWith('-') && arg !== '-') {
      throw new Error(`unknown option: ${arg}`);
    } else {
      options.files.push(arg);
    }
  }

  if (options.version) {
    process.stdout.write(`eyelang ${await packageVersion()}\n`);
    return;
  }

  if (options.files.length === 0) {
    options.files.push('-');
  }

  const sourceParts = [];
  let usedStdin = false;

  for (const file of options.files) {
    if (file === '-') {
      if (usedStdin) throw new Error("stdin input '-' can only be used once");
      usedStdin = true;
      sourceParts.push({ text: await readStdin(), filename: '<stdin>' });
    } else if (/^https?:\/\//.test(file)) {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`could not fetch URL: ${file}`);
      sourceParts.push({ text: await response.text(), filename: file });
    } else {
      sourceParts.push({ text: await fs.readFile(file, 'utf8'), filename: path.basename(file) || file });
    }
  }

  const engine = await loadEngine();
  const program = engine.Program.parseSources(sourceParts, { sourceMetadata: options.proof, markRecursive: options.proof, inputFormat: options.inputFormat });

  await runDefault(engine, program, options);
}

async function loadEngine() {
  if (engineModule == null) {
    const [term, program, solver, registry] = await Promise.all([
      import('./term.js'),
      import('./program.js'),
      import('./solver.js'),
      import('./builtins/registry.js'),
    ]);
    engineModule = { ...term, ...program, ...solver, ...registry };
  }
  return engineModule;
}

async function loadExplanation() {
  if (explanationModule == null) explanationModule = await import('./explain.js');
  return explanationModule;
}

async function runDefault(engine, program, options) {
  const goals = program.materializationGoals();
  const materializedKeys = new Set(goals.map((goal) => `${goal.name}/${goal.arity}`));
  const facts = program.sourceFactLines(materializedKeys);
  const lines = new Set();
  let lastStats = null;
  const registry = engine.getDefaultRegistry();
  const explanation = options.proof ? await loadExplanation() : null;

  for (const goal of goals) {
    const solver = new engine.Solver(program, { registry });

    for (const env of solver.solve([goal], new engine.Env(), 0)) {
      if (!engine.termIsGround(goal, env)) continue;

      const line = `${engine.termToString(goal, env, true)}.\n`;
      if (facts.has(line) || lines.has(line)) continue;

      lines.add(line);

      process.stdout.write(line);
      if (options.proof) writeExplanation(explanation, program, engine.copyResolved(goal, env), registry);
    }

    lastStats = solver.stats;
  }

  if (options.stats && lastStats) printStats(lastStats);
}

function writeExplanation(explanation, program, resolved, registry) {
  const proof = explanation.whyProof(program, resolved, { registry });
  process.stdout.write(proof.text);
  if (!proof.ok) process.stdout.write(explanation.whyNoProof(resolved));
}

async function usage(stream) {
  stream.write(`eyelang ${await packageVersion()}

Usage:
  eyelang [options] [file-or-url.pl|- ...]

Input:
  file-or-url.pl        Read an eyelang program from a local file or http(s) URL.
  -                     Read an eyelang program from standard input.

Options:
  -h, --help            Show this help text and exit.
  -p, --proof           Enable proof explanations.
  -s, --stats           Print solver statistics to stderr after execution.
  --rdf, --rdf12        Read input as RDF 1.2 Turtle/N-Triples compatibility syntax.
  --n3                  Read input as Notation3 rule compatibility syntax.
  --input-format FORMAT Use eyelang, auto, rdf12, turtle, nt, or n3.
  -v, --version         Show the package version and exit.
  --                    Stop option parsing; following arguments are treated as files.
`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function printStats(stats) {
  process.stderr.write('eyelang stats:\n');
  for (const [key, value] of Object.entries(stats)) {
    process.stderr.write(`  ${key}: ${value}\n`);
  }
}

async function packageVersion() {
  try {
    const text = await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(text);
    if (pkg && typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch (_) {
    // Fall through to a stable marker if package metadata is unavailable.
  }

  return 'unknown';
}
