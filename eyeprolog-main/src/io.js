// Synchronous ISO stream state shared by a solver and all of its inner solvers.
import { BufferCtor, fs } from './platform.js';

export const INVALID_UTF8_SENTINEL = '\udc00';

export class InvalidCharacterEncodingError extends Error {
  constructor() {
    super('invalid character encoding');
    this.name = 'InvalidCharacterEncodingError';
  }
}

function decodeUtf8ForTextStream(buffer) {
  const bytes = buffer;
  let text = '';
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i];
    if (first <= 0x7f) {
      text += String.fromCodePoint(first);
      i++;
      continue;
    }

    let width = 0;
    let code = 0;
    let minimum = 0;
    if (first >= 0xc2 && first <= 0xdf) { width = 2; code = first & 0x1f; minimum = 0x80; }
    else if (first >= 0xe0 && first <= 0xef) { width = 3; code = first & 0x0f; minimum = 0x800; }
    else if (first >= 0xf0 && first <= 0xf4) { width = 4; code = first & 0x07; minimum = 0x10000; }

    let valid = width !== 0 && i + width <= bytes.length;
    if (valid) {
      for (let j = 1; j < width; j++) {
        const continuation = bytes[i + j];
        if ((continuation & 0xc0) !== 0x80) { valid = false; break; }
        code = (code << 6) | (continuation & 0x3f);
      }
      if (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) valid = false;
    }

    if (!valid) {
      // A lone low surrogate cannot be produced by valid UTF-8. Keep it as a
      // positional marker so open/4 succeeds and character input predicates
      // can report representation_error(character) when the bad byte is read.
      text += INVALID_UTF8_SENTINEL;
      i++;
      continue;
    }
    text += String.fromCodePoint(code);
    i += width;
  }
  return text;
}

export class StreamManager {
  constructor(options = {}) {
    this.nextId = 2;
    this.streams = new Map();
    this.aliases = new Map();
    this.output = options.write ?? (() => {});
    this.add({ id: 0, alias: 'user_input', mode: 'read', type: 'text',
      content: String(options.input ?? ''), position: 0, path: '',
      reposition: false, eofAction: 'reset', standard: true, pastEnd: false });
    this.add({ id: 1, alias: 'user_output', mode: 'append', type: 'text',
      content: '', position: 0, path: '', reposition: false,
      eofAction: 'reset', standard: true, write: this.output, pastEnd: false });
    // user_error is a conventional de-facto standard stream used by the
    // portable Scryer/Trealla libraries. Keep it on a negative internal handle
    // so the first user-opened ISO stream retains its historical id 2.
    this.add({ id: -1, alias: 'user_error', mode: 'append', type: 'text',
      content: '', position: 0, path: '', reposition: false,
      eofAction: 'reset', standard: true, write: options.errorWrite ?? this.output, pastEnd: false });
    this.currentInput = 0;
    this.currentOutput = 1;
  }
  add(stream) {
    this.streams.set(stream.id, stream);
    if (stream.alias) this.aliases.set(stream.alias, stream.id);
    return stream;
  }
  resolve(reference) {
    if (typeof reference === 'string') {
      const id = this.aliases.get(reference);
      return id == null ? null : this.streams.get(id) ?? null;
    }
    return this.streams.get(reference) ?? null;
  }
  open(path, mode, options = {}) {
    if (!fs) throw new Error('file streams are unavailable in this runtime');
    const type = options.type ?? 'text';
    let content = type === 'binary' ? [] : '';
    let strictUtf8 = false;
    if (mode === 'read') {
      const raw = fs.readFileSync(path);
      if (type === 'binary') content = raw;
      else { content = decodeUtf8ForTextStream(raw); strictUtf8 = true; }
    } else if (mode === 'write') {
      // ISO 7.10.1.1: opening an existing sink in write mode empties it,
      // while a missing sink is created at open time (not deferred to close).
      fs.writeFileSync(path, type === 'binary' ? BufferCtor.from([]) : '');
    } else if (mode === 'append') {
      if (fs.existsSync(path)) content = fs.readFileSync(path, type === 'binary' ? null : 'utf8');
      else fs.writeFileSync(path, type === 'binary' ? BufferCtor.from([]) : '');
    }
    if (BufferCtor?.isBuffer(content)) content = [...content];
    return this.add({
      id: this.nextId++, alias: options.alias ?? null, mode, type, content, strictUtf8,
      position: mode === 'append' ? content.length : 0, path,
      reposition: options.reposition ?? false,
      eofAction: options.eof_action ?? 'error', standard: false,
      pastEnd: false,
    });
  }
  flush(stream) {
    if (!stream || stream.standard || (stream.mode === 'read' && stream.writable !== true)) return;
    if (typeof stream.flush === 'function') { stream.flush(); return; }
    fs.writeFileSync(stream.path, stream.type === 'binary' ? BufferCtor.from(stream.content) : stream.content);
  }
  discard(stream) {
    if (stream.alias) this.aliases.delete(stream.alias);
    this.streams.delete(stream.id);
  }
  close(stream) {
    if (typeof stream.closeTransport !== 'function') {
      this.flush(stream);
      this.discard(stream);
      return;
    }
    let error = null;
    try { this.flush(stream); } catch (caught) { error = caught; }
    try { stream.closeTransport(); } catch (caught) { error ??= caught; }
    this.discard(stream);
    if (error != null) throw error;
  }
  refill(stream) {
    if (typeof stream?.interactiveReadUnit !== 'function') return false;
    if (stream.continuousRefill === true && stream.position >= stream.content.length && stream.position > 0) {
      stream.content = stream.type === 'binary' ? [] : '';
      stream.position = 0;
    }
    const value = stream.interactiveReadUnit();
    if (value == null) return false;
    if (stream.type === 'binary') {
      const incoming = Array.isArray(value) ? value : [...value];
      stream.content.push(...incoming);
    } else {
      stream.content += String(value);
    }
    stream.pastEnd = false;
    return true;
  }
  readUnit(stream, peek = false) {
    if (stream.position >= stream.content.length) return null;
    if (stream.type === 'binary') {
      const value = stream.content[stream.position];
      if (!peek) stream.position++;
      stream.pastEnd = false;
      return value;
    }
    const source = String(stream.content);
    if (stream.strictUtf8 && source[stream.position] === INVALID_UTF8_SENTINEL) {
      throw new InvalidCharacterEncodingError();
    }
    const codePoint = source.codePointAt(stream.position);
    const value = String.fromCodePoint(codePoint);
    if (!peek) stream.position += value.length;
    stream.pastEnd = false;
    return value;
  }
  writeUnit(stream, value) {
    if (typeof stream.writeUnit === 'function') {
      stream.writeUnit(value);
      return;
    }
    if (stream.standard && stream.write) {
      stream.write(String(value));
      return;
    }
    // 7.10.2.8: output after repositioning overwrites the existing sink
    // contents at the selected stream position rather than always appending.
    if (stream.type === 'binary') {
      if (stream.position < stream.content.length) stream.content[stream.position] = value;
      else stream.content.push(value);
      stream.position++;
      return;
    }
    const text = String(value);
    const content = String(stream.content);
    const end = Math.min(content.length, stream.position + text.length);
    stream.content = `${content.slice(0, stream.position)}${text}${content.slice(end)}`;
    stream.position += text.length;
  }
}
