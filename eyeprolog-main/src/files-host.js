// Runtime filesystem services for library(files).

import { fs, isNode } from './platform.js';
import { ATOM, VAR, atom, copyResolved, deref, numberTerm, unify } from './term.js';
import { PrologError } from './errors.js';
import { characterListText, chars, dateTimeTerm, listOfChars } from './host-utils.js';

let pathModule = null;
if (isNode) pathModule = await import('node:path');

function requireNode(resource = 'filesystem') {
  if (!isNode || fs == null) throw new PrologError(`resource_error(${resource})`);
}

function nodePath(term, env) {
  requireNode();
  return characterListText(term, env);
}

function systemError(error, operation, culprit = null) {
  if (error?.code === 'ENOENT') return new PrologError(`existence_error(${operation})`, culprit);
  if (error?.code === 'EEXIST') return new PrologError(`permission_error(create, ${operation})`, culprit);
  if (error?.code === 'ENOTEMPTY') return new PrologError(`permission_error(delete, ${operation})`, culprit);
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return new PrologError(`permission_error(access, ${operation})`, culprit);
  return new PrologError('resource_error(system_error)', culprit);
}

function stat(path, culprit, operation = 'file') {
  try { return fs.statSync(path); }
  catch (error) { throw systemError(error, operation, culprit); }
}

function* directoryFilesBuiltin({ goal, env }) {
  const directory = nodePath(goal.args[0], env);
  let entries;
  try { entries = ['.', '..', ...fs.readdirSync(directory)]; }
  catch (error) { throw systemError(error, 'directory', copyResolved(goal.args[0], env)); }
  const next = env.clone();
  if (unify(goal.args[1], listOfChars(entries), next)) yield next;
}

function* fileSizeBuiltin({ goal, env }) {
  const file = nodePath(goal.args[0], env);
  const info = stat(file, copyResolved(goal.args[0], env));
  if (!info.isFile()) throw new PrologError('existence_error(file)', copyResolved(goal.args[0], env));
  const next = env.clone();
  if (unify(goal.args[1], numberTerm(info.size), next)) yield next;
}

function* fileExistsBuiltin({ goal, env }) {
  const file = nodePath(goal.args[0], env);
  try { if (fs.statSync(file).isFile()) yield env; } catch (error) { if (error?.code !== 'ENOENT') throw systemError(error, 'file', copyResolved(goal.args[0], env)); }
}

function* directoryExistsBuiltin({ goal, env }) {
  const directory = nodePath(goal.args[0], env);
  try { if (fs.statSync(directory).isDirectory()) yield env; } catch (error) { if (error?.code !== 'ENOENT') throw systemError(error, 'directory', copyResolved(goal.args[0], env)); }
}

function* deleteFileBuiltin({ goal, env }) {
  const file = nodePath(goal.args[0], env);
  try { fs.unlinkSync(file); }
  catch (error) { throw systemError(error, 'file', copyResolved(goal.args[0], env)); }
  yield env;
}

function* renameFileBuiltin({ goal, env }) {
  const from = nodePath(goal.args[0], env), to = nodePath(goal.args[1], env);
  try { fs.renameSync(from, to); }
  catch (error) { throw systemError(error, 'file', copyResolved(goal.args[0], env)); }
  yield env;
}

function* fileCopyBuiltin({ goal, env }) {
  const from = nodePath(goal.args[0], env), to = nodePath(goal.args[1], env);
  try { fs.copyFileSync(from, to); }
  catch (error) { throw systemError(error, 'file', copyResolved(goal.args[0], env)); }
  yield env;
}

function* deleteDirectoryBuiltin({ goal, env }) {
  const directory = nodePath(goal.args[0], env);
  try { fs.rmdirSync(directory); }
  catch (error) { throw systemError(error, 'directory', copyResolved(goal.args[0], env)); }
  yield env;
}

function* makeDirectoryBuiltin({ goal, env }) {
  const directory = nodePath(goal.args[0], env);
  try { fs.mkdirSync(directory); }
  catch (error) { throw systemError(error, 'directory', copyResolved(goal.args[0], env)); }
  yield env;
}

function* makeDirectoryPathBuiltin({ goal, env }) {
  const directory = nodePath(goal.args[0], env);
  try { fs.mkdirSync(directory, { recursive: true }); }
  catch (error) { throw systemError(error, 'directory', copyResolved(goal.args[0], env)); }
  yield env;
}

function* workingDirectoryBuiltin({ goal, env }) {
  requireNode();
  const old = process.cwd();
  const requested = deref(goal.args[1], env);
  const next = env.clone();
  if (!unify(goal.args[0], chars(old), next)) return;
  if (requested.type === VAR) {
    if (unify(goal.args[1], chars(old), next)) yield next;
    return;
  }
  const directory = characterListText(goal.args[1], env);
  try { process.chdir(directory); }
  catch (error) { throw systemError(error, 'directory', copyResolved(goal.args[1], env)); }
  yield next;
}

function* pathCanonicalBuiltin({ goal, env }) {
  const input = nodePath(goal.args[0], env);
  let canonical;
  try { canonical = fs.realpathSync(input); }
  catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
    throw systemError(error, 'path', copyResolved(goal.args[0], env));
  }
  const next = env.clone();
  if (unify(goal.args[1], chars(canonical), next)) yield next;
}

function* directorySeparatorBuiltin({ goal, env }) {
  requireNode();
  const separator = pathModule?.sep ?? '/';
  const next = env.clone();
  if (unify(goal.args[0], atom(separator), next)) yield next;
}

function fileTime(info, which) {
  if (which === 'modification') return info.mtime;
  if (which === 'access') return info.atime;
  if (which === 'creation') return info.birthtime;
  return null;
}

function* fileTimeBuiltin({ goal, env }) {
  const file = nodePath(goal.args[0], env);
  const which = deref(goal.args[1], env);
  if (which.type === VAR) throw new PrologError('instantiation_error');
  if (which.type !== ATOM || !['modification', 'access', 'creation'].includes(which.name)) {
    throw new PrologError('domain_error(file_time)', copyResolved(which, env));
  }
  const info = stat(file, copyResolved(goal.args[0], env));
  const date = fileTime(info, which.name);
  const next = env.clone();
  if (unify(goal.args[2], dateTimeTerm(date), next)) yield next;
}

export const filesHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__directory_files', 2, directoryFilesBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__file_size', 2, fileSizeBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__file_exists', 1, fileExistsBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__directory_exists', 1, directoryExistsBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__delete_file', 1, deleteFileBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__rename_file', 2, renameFileBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__file_copy', 2, fileCopyBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__delete_directory', 1, deleteDirectoryBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__make_directory', 1, makeDirectoryBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__make_directory_path', 1, makeDirectoryPathBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__working_directory', 2, workingDirectoryBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__path_canonical', 2, pathCanonicalBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__directory_separator', 1, directorySeparatorBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__file_time', 3, fileTimeBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
