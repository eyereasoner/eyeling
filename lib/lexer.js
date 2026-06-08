/**
 * Eyeling Reasoner — lexer
 *
 * Tokenizer for the supported N3/Turtle-like syntax. Produces a token stream
 * consumed by lib/parser.js.
 */

'use strict';

class Token {
  constructor(typ, value = null, offset = null) {
    this.typ = typ;
    this.value = value;
    // Codepoint offset in the original source (Array.from(text) index).
    this.offset = offset;
  }
  toString() {
    const loc = typeof this.offset === 'number' ? `@${this.offset}` : '';
    if (this.value == null) return `Token(${this.typ}${loc})`;
    return `Token(${this.typ}${loc}, ${JSON.stringify(this.value)})`;
  }
}

class N3SyntaxError extends SyntaxError {
  constructor(message, offset = null) {
    super(message);
    this.name = 'N3SyntaxError';
    this.offset = offset;
  }
}

function isWs(c) {
  if (c === null || c === undefined) return false;
  const code = c.charCodeAt(0);
  // Fast path for the whitespace used by N3/Turtle inputs.
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x0c;
}

function isAsciiAlphaCode(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigitCode(code) {
  return code >= 48 && code <= 57;
}

function isAsciiAlpha(c) {
  return c !== null && c !== undefined && isAsciiAlphaCode(c.charCodeAt(0));
}

function isAsciiDigit(c) {
  return c !== null && c !== undefined && isAsciiDigitCode(c.charCodeAt(0));
}

// Turtle/N3 prefixed names (PNAME_*) allow many Unicode letters and certain
// punctuation, plus %-escapes and backslash escapes in PN_LOCAL.
//
// The original lexer only accepted ASCII in identifiers, which incorrectly
// rejected valid N3 such as:
//   res:COUNTRY_United%20States rdfs:label "United States".
//   res:CITY_Chañaral rdfs:label "Chañaral".
//
// We implement a grammar-aligned matcher for PN_CHARS* and PLX fragments.
function isHexDigit(c) {
  if (c === null || c === undefined) return false;
  const code = c.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function isPnCharsBase(c) {
  // Approximation of PN_CHARS_BASE from the N3 grammar using Unicode properties.
  // Covers most letters used in practice (including ñ) and common scripts.
  if (c === null || c === undefined) return false;
  const code = c.charCodeAt(0);
  if (isAsciiAlphaCode(code)) return true;
  return /\p{L}|\p{Nl}/u.test(c);
}

function isPnCharsU(c) {
  // PN_CHARS_U ::= PN_CHARS_BASE | '_'
  return c === '_' || isPnCharsBase(c);
}

function isPnChars(c) {
  // PN_CHARS ::= PN_CHARS_U | '-' | [0-9] | U+00B7 | [U+0300-U+036F] | [U+203F-U+2040]
  if (c === null || c === undefined) return false;
  const code = c.charCodeAt(0);
  if (isAsciiAlphaCode(code) || isAsciiDigitCode(code) || code === 95 || code === 45) return true;
  if (isPnCharsU(c)) return true;
  if (c === '\u00B7') return true;
  const cp = c.codePointAt(0);
  return (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x203f && cp <= 0x2040);
}

// PN_LOCAL_ESC from the N3/Turtle grammar.
const PN_LOCAL_ESC_SET = new Set([
  '_',
  '~',
  '.',
  '-',
  '!',
  '$',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  ';',
  '=',
  '/',
  '?',
  '#',
  '@',
  '%',
]);

function isIdentChar(c) {
  // Allowed raw chars in PNAME tokens beyond PN_CHARS*: ':' is allowed in PN_LOCAL.
  return c === ':' || isPnChars(c);
}

function isForbiddenNoncharacterCodePoint(cp) {
  return (cp & 0xffff) === 0xfffe || (cp & 0xffff) === 0xffff;
}

function validateEscapedCodePoint(cp, offset = null, escapeKind = 'escape') {
  if (cp === 0x0000) {
    throw new N3SyntaxError(`Invalid string literal: ${escapeKind} U+0000 is not allowed`, offset);
  }
  if (cp >= 0xd800 && cp <= 0xdfff) {
    throw new N3SyntaxError(`Invalid string literal: ${escapeKind} surrogate code points are not allowed`, offset);
  }
  if (isForbiddenNoncharacterCodePoint(cp)) {
    throw new N3SyntaxError(
      `Invalid string literal: ${escapeKind} noncharacter U+${cp
        .toString(16)
        .toUpperCase()
        .padStart(cp <= 0xffff ? 4 : 6, '0')} is not allowed`,
      offset,
    );
  }
}

function decodeN3StringEscapes(s, offset = null) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    if (i + 1 >= s.length) {
      out += '\\';
      continue;
    }
    const e = s[++i];
    switch (e) {
      case 't':
        out += '\t';
        break;
      case 'n':
        out += '\n';
        break;
      case 'r':
        out += '\r';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case '"':
        out += '"';
        break;
      case "'":
        out += "'";
        break;
      case '\\':
        out += '\\';
        break;

      case 'u': {
        const hex = s.slice(i + 1, i + 5);
        if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
          const cp = parseInt(hex, 16);
          validateEscapedCodePoint(cp, offset, '\\u');
          out += String.fromCharCode(cp);
          i += 4;
        } else {
          out += '\\u';
        }
        break;
      }

      case 'U': {
        const hex = s.slice(i + 1, i + 9);
        if (/^[0-9A-Fa-f]{8}$/.test(hex)) {
          const cp = parseInt(hex, 16);
          if (cp >= 0 && cp <= 0x10ffff) {
            validateEscapedCodePoint(cp, offset, '\\U');
            out += String.fromCodePoint(cp);
          } else out += '\\U' + hex;
          i += 8;
        } else {
          out += '\\U';
        }
        break;
      }

      default:
        // preserve unknown escapes
        out += '\\' + e;
    }
  }
  return out;
}

function formatCodePoint(cp) {
  return cp
    .toString(16)
    .toUpperCase()
    .padStart(cp <= 0xffff ? 4 : 6, '0');
}

function isForbiddenIriRefChar(c) {
  return (
    c === '<' || c === '>' || c === '"' || c === '{' || c === '}' || c === '|' || c === '^' || c === '`' || c === '\\'
  );
}

function assertValidIriRefCodePoint(cp, offset = null) {
  if (cp <= 0x20) {
    throw new N3SyntaxError(`Invalid IRIREF: character U+${formatCodePoint(cp)} is not allowed inside <...>`, offset);
  }

  if (cp >= 0xd800 && cp <= 0xdfff) {
    throw new N3SyntaxError(
      `Invalid IRIREF: surrogate code point U+${formatCodePoint(cp)} is not allowed inside <...>`,
      offset,
    );
  }

  if (isForbiddenNoncharacterCodePoint(cp)) {
    throw new N3SyntaxError(
      `Invalid IRIREF: noncharacter U+${formatCodePoint(cp)} is not allowed inside <...>`,
      offset,
    );
  }

  const c = String.fromCodePoint(cp);
  if (isForbiddenIriRefChar(c)) {
    throw new N3SyntaxError(`Invalid IRIREF: character ${JSON.stringify(c)} is not allowed inside <...>`, offset);
  }
}

function decodeIriRefEscapes(s, offset = null) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      const cp = c.codePointAt(0);
      assertValidIriRefCodePoint(cp, offset);
      out += c;
      continue;
    }

    if (i + 1 >= s.length) {
      throw new N3SyntaxError('Invalid IRIREF: bare backslash is not allowed inside <...>', offset);
    }

    const e = s[++i];
    if (e === 'u') {
      const hex = s.slice(i + 1, i + 5);
      if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
        throw new N3SyntaxError('Invalid IRIREF: malformed \\u escape inside <...>', offset);
      }
      const cp = parseInt(hex, 16);
      assertValidIriRefCodePoint(cp, offset);
      out += String.fromCodePoint(cp);
      i += 4;
      continue;
    }

    if (e === 'U') {
      const hex = s.slice(i + 1, i + 9);
      if (!/^[0-9A-Fa-f]{8}$/.test(hex)) {
        throw new N3SyntaxError('Invalid IRIREF: malformed \\U escape inside <...>', offset);
      }
      const cp = parseInt(hex, 16);
      if (cp < 0 || cp > 0x10ffff) {
        throw new N3SyntaxError(`Invalid IRIREF: code point U+${hex.toUpperCase()} is out of range`, offset);
      }
      assertValidIriRefCodePoint(cp, offset);
      out += String.fromCodePoint(cp);
      i += 8;
      continue;
    }

    throw new N3SyntaxError(
      `Invalid IRIREF: character ${JSON.stringify('\\' + e)} is not allowed inside <...>`,
      offset,
    );
  }
  return out;
}

function assertValidStringLiteralValue(s, offset = null) {
  for (let i = 0; i < s.length; i++) {
    const cu = s.charCodeAt(i);

    if (cu === 0x0000) {
      throw new N3SyntaxError('Invalid string literal: U+0000 is not allowed', offset);
    }

    // Reject lone UTF-16 surrogates. Valid astral characters appear as a
    // well-formed high+low surrogate pair and are accepted.
    if (cu >= 0xd800 && cu <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new N3SyntaxError('Invalid string literal: unpaired high surrogate is not allowed', offset);
      }
      const cp = ((cu - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
      if (isForbiddenNoncharacterCodePoint(cp)) {
        throw new N3SyntaxError(
          `Invalid string literal: noncharacter U+${cp.toString(16).toUpperCase().padStart(6, '0')} is not allowed`,
          offset,
        );
      }
      i += 1;
      continue;
    }

    if (cu >= 0xdc00 && cu <= 0xdfff) {
      throw new N3SyntaxError('Invalid string literal: unpaired low surrogate is not allowed', offset);
    }

    if (isForbiddenNoncharacterCodePoint(cu)) {
      throw new N3SyntaxError(
        `Invalid string literal: noncharacter U+${cu.toString(16).toUpperCase().padStart(4, '0')} is not allowed`,
        offset,
      );
    }
  }
}

// In the monolithic build, stripQuotes() is defined later in the file and
// function-hoisting makes it available to lex(). In the modular build the
// lexer must provide it locally.
function stripQuotes(lex) {
  if (typeof lex !== 'string') return lex;
  // Handle both short ('...' / "...") and long ('''...''' / """...""") forms.
  if (lex.length >= 6) {
    if (lex.startsWith('"""') && lex.endsWith('"""')) return lex.slice(3, -3);
    if (lex.startsWith("'''") && lex.endsWith("'''")) return lex.slice(3, -3);
  }
  if (lex.length >= 2) {
    const a = lex[0];
    const b = lex[lex.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return lex.slice(1, -1);
  }
  return lex;
}


// RDF/TriG compatibility is an opt-in syntax-normalization layer, not a new
// reasoning model. Eyeling remains strict N3 by default and N3 internally:
//   - RDF 1.2 triple terms <<( s p o )>> become singleton graph terms { s p o }.
//   - TriG named graph blocks g { ... } become g log:nameOf { ... } .
//   - A top-level default graph block { ... } is unwrapped into ordinary triples.
// This keeps all downstream parsing/reasoning N3-only.
const LOG_NAME_OF_IRI = '<http://www.w3.org/2000/10/swap/log#nameOf>';
const RDF_REIFIES_IRI = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies>';
const RDF_TYPE_IRI = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>';
const XSD_INTEGER_IRI = '<http://www.w3.org/2001/XMLSchema#integer>';
const EYMSG_NS = 'https://eyereasoner.github.io/eyeling/vocab/message#';
const EYMSG = Object.freeze({
  RDFMessageStream: `<${EYMSG_NS}RDFMessageStream>`,
  MessageEnvelope: `<${EYMSG_NS}MessageEnvelope>`,
  envelope: `<${EYMSG_NS}envelope>`,
  firstEnvelope: `<${EYMSG_NS}firstEnvelope>`,
  lastEnvelope: `<${EYMSG_NS}lastEnvelope>`,
  orderedEnvelopes: `<${EYMSG_NS}orderedEnvelopes>`,
  messageCount: `<${EYMSG_NS}messageCount>`,
  offset: `<${EYMSG_NS}offset>`,
  nextEnvelope: `<${EYMSG_NS}nextEnvelope>`,
  payloadGraph: `<${EYMSG_NS}payloadGraph>`,
  payloadKind: `<${EYMSG_NS}payloadKind>`,
  empty: `<${EYMSG_NS}empty>`,
  nonEmpty: `<${EYMSG_NS}nonEmpty>`,
});

function normalizeRdfCompatibility(inputText) {
  let text = String(inputText ?? '');

  // Fast path: most Eyeling inputs are ordinary N3 and do not need RDF/TriG
  // surface-syntax normalization. Avoid scanning large files character-by-character
  // unless they actually contain RDF 1.2 triple terms, VERSION directives, or a
  // plausible top-level TriG named graph block.
  const hasTripleTerms = text.includes('<<');
  const hasVersionDirective = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)\1\s*\.?\s*(?:#.*)?$/im.test(text);
  const hasMessageVersionDirective = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)-messages\1\s*\.?\s*(?:#.*)?$/im.test(text);
  const hasNamedGraphCandidate = /(?:^|[.\r\n])\s*(?:GRAPH\s+)?(?:<[^>\r\n]*>|_:[A-Za-z][A-Za-z0-9_-]*|[A-Za-z][A-Za-z0-9_-]*:[^\s{};,.()[\]]*|:[^\s{};,.()[\]]+)\s*\{/m.test(text);
  const hasAnnotationSyntax = /(?:^|\s)~|\{\|/.test(text);

  if (!hasTripleTerms && !hasVersionDirective && !hasMessageVersionDirective && !hasNamedGraphCandidate && !hasAnnotationSyntax) return text;

  function isWordChar(ch) {
    return ch != null && /[A-Za-z0-9_:-]/.test(ch);
  }

  function startsWordAt(s, word, at) {
    return s.startsWith(word, at) && !isWordChar(s[at - 1]) && !isWordChar(s[at + word.length]);
  }

  function readStringAt(s, at) {
    const quote = s[at];
    let i = at;
    let out = quote;
    const long = s.startsWith(quote.repeat(3), i);
    if (long) {
      out = quote.repeat(3);
      i += 3;
      while (i < s.length) {
        if (s.startsWith(quote.repeat(3), i)) {
          out += quote.repeat(3);
          i += 3;
          return { text: out, end: i };
        }
        if (s[i] === '\\' && i + 1 < s.length) {
          out += s.slice(i, i + 2);
          i += 2;
        } else {
          out += s[i++];
        }
      }
      return { text: out, end: i };
    }
    i += 1;
    let escaped = false;
    while (i < s.length) {
      const ch = s[i++];
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        break;
      }
    }
    return { text: out, end: i };
  }

  function readIriAt(s, at) {
    let i = at + 1;
    let out = '<';
    while (i < s.length) {
      const ch = s[i++];
      out += ch;
      if (ch === '>') break;
    }
    return { text: out, end: i };
  }

  function convertTripleTerms(s) {
    let i = 0;
    const reifierTriples = [];

    function startsAt(needle, at = i) {
      return s.startsWith(needle, at);
    }

    function splitTopLevelReifier(body) {
      let depthBrace = 0;
      let depthBracket = 0;
      let depthParen = 0;
      for (let j = 0; j < body.length; j++) {
        const ch = body[j];
        if (ch === '"' || ch === "'") {
          const str = readStringAt(body, j);
          j = str.end - 1;
          continue;
        }
        if (ch === '<') {
          const iri = readIriAt(body, j);
          j = iri.end - 1;
          continue;
        }
        if (ch === '#') {
          while (j < body.length && body[j] !== '\n' && body[j] !== '\r') j += 1;
          continue;
        }
        if (ch === '{') depthBrace += 1;
        else if (ch === '}' && depthBrace > 0) depthBrace -= 1;
        else if (ch === '[') depthBracket += 1;
        else if (ch === ']' && depthBracket > 0) depthBracket -= 1;
        else if (ch === '(') depthParen += 1;
        else if (ch === ')' && depthParen > 0) depthParen -= 1;
        else if (ch === '~' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) {
          return { triple: body.slice(0, j).trim(), reifier: body.slice(j + 1).trim() };
        }
      }
      return { triple: body.trim(), reifier: '' };
    }

    function firstTerm(text) {
      const at = skipWsAndComments(text, 0);
      if (at >= text.length) return '';
      if (text[at] === '<') return readIriAt(text, at).text;
      let j = at;
      while (j < text.length && !/\s/.test(text[j]) && !'{}[](),;.'.includes(text[j])) j += 1;
      return text.slice(at, j);
    }

    function readBalancedTermAt(text, at) {
      const open = text[at];
      const matching = { '{': '}', '[': ']', '(': ')' };
      if (!matching[open]) return null;

      const stack = [matching[open]];
      let j = at + 1;
      while (j < text.length) {
        const ch = text[j];
        if (ch === '"' || ch === "'") {
          const str = readStringAt(text, j);
          j = str.end;
          continue;
        }
        if (ch === '<' && !text.startsWith('<<', j)) {
          const iri = readIriAt(text, j);
          j = iri.end;
          continue;
        }
        if (ch === '#') {
          while (j < text.length && text[j] !== '\n' && text[j] !== '\r') j += 1;
          continue;
        }
        if (matching[ch]) {
          stack.push(matching[ch]);
          j += 1;
          continue;
        }
        if (ch === stack[stack.length - 1]) {
          stack.pop();
          j += 1;
          if (stack.length === 0) return { text: text.slice(at, j), end: j };
          continue;
        }
        j += 1;
      }

      throw new N3SyntaxError(`Unterminated term inside RDF 1.2 triple term, expected ${stack[stack.length - 1]}`);
    }

    function readRdfTripleTermComponent(text, at) {
      const j = skipWsAndComments(text, at);
      if (j >= text.length) return null;
      const ch = text[j];

      if (ch === '<') return readIriAt(text, j);

      if (ch === '"' || ch === "'") {
        const str = readStringAt(text, j);
        let end = str.end;
        let termText = str.text;
        if (text.startsWith('^^', end)) {
          const datatype = readRdfTripleTermComponent(text, end + 2);
          if (datatype) {
            termText += '^^' + datatype.text;
            end = datatype.end;
          }
        } else if (text[end] === '@') {
          let k = end + 1;
          if (/[A-Za-z]/.test(text[k] || '')) {
            while (k < text.length && /[A-Za-z0-9-]/.test(text[k])) k += 1;
            termText += text.slice(end, k);
            end = k;
          }
        }
        return { text: termText, end };
      }

      if (ch === '{' || ch === '[' || ch === '(') return readBalancedTermAt(text, j);

      let k = j;
      while (k < text.length && !/\s/.test(text[k]) && !'{}[](),;'.includes(text[k])) k += 1;
      if (k === j) return null;
      const value = text.slice(j, k);
      if (!value || value.startsWith('@')) return null;
      return { text: value, end: k };
    }

    function validateSingleRdfTripleTerm(rawTriple) {
      const triple = rawTriple.trim();
      if (!triple) throw new N3SyntaxError('RDF 1.2 triple term must contain exactly one subject, predicate, and object');

      let pos = 0;
      for (const label of ['subject', 'predicate', 'object']) {
        const term = readRdfTripleTermComponent(triple, pos);
        if (!term) throw new N3SyntaxError(`RDF 1.2 triple term is missing a ${label}`);
        pos = term.end;
      }

      const rest = skipWsAndComments(triple, pos);
      if (rest >= triple.length) return;

      const found = triple[rest];
      if (found === ',') {
        throw new N3SyntaxError("RDF 1.2 triple terms must contain exactly one object; object lists using ',' are not valid inside <<( ... )>>");
      }
      if (found === ';') {
        throw new N3SyntaxError("RDF 1.2 triple terms must contain exactly one predicate-object pair; ';' is not valid inside <<( ... )>>");
      }
      throw new N3SyntaxError(`RDF 1.2 triple term must contain exactly one subject, predicate, and object; unexpected ${JSON.stringify(triple.slice(rest, rest + 20))}`);
    }

    function graphTermFromTripleBody(rawBody, parenthesized) {
      let body = rawBody.trim();
      if (parenthesized && body.startsWith('(') && body.endsWith(')')) body = body.slice(1, -1).trim();
      const split = splitTopLevelReifier(body);
      const triple = split.triple;
      validateSingleRdfTripleTerm(triple);
      const graph = '{ ' + triple + ' }';
      if (split.reifier) {
        const reifier = firstTerm(split.reifier);
        if (reifier) reifierTriples.push(`${reifier} ${RDF_REIFIES_IRI} ${graph} .`);
      }
      return graph;
    }

    function convertUntil(stopToken) {
      let out = '';
      while (i < s.length) {
        if (stopToken && startsAt(stopToken)) {
          i += stopToken.length;
          return out;
        }
        if (startsAt('<<(')) {
          i += 3;
          out += graphTermFromTripleBody(convertUntil(')>>'), false);
          continue;
        }
        if (startsAt('<<')) {
          i += 2;
          out += graphTermFromTripleBody(convertUntil('>>'), false);
          continue;
        }
        const ch = s[i];
        if (ch === '"' || ch === "'") {
          const str = readStringAt(s, i);
          out += str.text;
          i = str.end;
          continue;
        }
        if (ch === '<') {
          const iri = readIriAt(s, i);
          out += iri.text;
          i = iri.end;
          continue;
        }
        if (ch === '#') {
          while (i < s.length) {
            const c = s[i++];
            out += c;
            if (c === '\n' || c === '\r') break;
          }
          continue;
        }
        out += ch;
        i += 1;
      }
      if (stopToken) throw new N3SyntaxError(`Unterminated RDF 1.2 triple term, expected ${stopToken}`);
      return out;
    }

    const converted = convertUntil(null);
    if (reifierTriples.length === 0) return converted;
    return converted + (converted.endsWith('\n') ? '' : '\n') + reifierTriples.join('\n') + '\n';
  }


  function convertAnnotations(s) {
    let out = '';
    let i = 0;
    let statementStart = true;
    let generatedBlank = 0;

    function readBalancedDelimited(s, at, open, close) {
      if (!s.startsWith(open, at)) return null;
      let j = at + open.length;
      let depth = 1;
      while (j < s.length) {
        const ch = s[j];
        if (ch === '"' || ch === "'") {
          j = readStringAt(s, j).end;
          continue;
        }
        if (ch === '<' && !s.startsWith('<<', j)) {
          j = readIriAt(s, j).end;
          continue;
        }
        if (ch === '#') {
          while (j < s.length && s[j] !== '\n' && s[j] !== '\r') j += 1;
          continue;
        }
        if (s.startsWith(open, j)) {
          depth += 1;
          j += open.length;
          continue;
        }
        if (s.startsWith(close, j)) {
          depth -= 1;
          j += close.length;
          if (depth === 0) return { text: s.slice(at, j), inner: s.slice(at + open.length, j - close.length), end: j };
          continue;
        }
        j += 1;
      }
      throw new N3SyntaxError(`Unterminated RDF annotation block, expected ${close}`);
    }

    function readTermLikeAt(s, at) {
      const j = skipWsAndComments(s, at);
      if (j >= s.length) return null;
      if (s[j] === '<') return readIriAt(s, j);
      if (s[j] === '"' || s[j] === "'") {
        const str = readStringAt(s, j);
        let end = str.end;
        let text = str.text;
        if (s.startsWith('^^', end)) {
          const dt = readTermAt(s, end + 2);
          if (dt) {
            text += '^^' + dt.text;
            end = dt.end;
          }
        } else if (s[end] === '@') {
          let k = end + 1;
          if (/[A-Za-z]/.test(s[k] || '')) {
            while (k < s.length && /[A-Za-z0-9-]/.test(s[k])) k += 1;
            text += s.slice(end, k);
            end = k;
          }
        }
        return { text, end };
      }
      if (s[j] === '{') return readBalancedBlock(s, j);
      if (s[j] === '[') return readBalancedDelimited(s, j, '[', ']');
      if (s[j] === '(') return readBalancedDelimited(s, j, '(', ')');
      return readTermAt(s, j);
    }

    function readAnnotationBlockAt(s, at) {
      if (!s.startsWith('{|', at)) return null;
      return readBalancedDelimited(s, at, '{|', '|}');
    }

    function tryReadAnnotatedTriple(at) {
      const start = skipWsAndComments(s, at);
      if (start >= s.length) return null;
      if (s[start] === '@') return null;
      if (startsWordAt(s, 'PREFIX', start) || startsWordAt(s, 'BASE', start) || startsWordAt(s, 'VERSION', start)) return null;
      if (startsWordAt(s, 'GRAPH', start)) return null;

      const subj = readTermLikeAt(s, start);
      if (!subj) return null;
      let j = skipWsAndComments(s, subj.end);
      const pred = readTermLikeAt(s, j);
      if (!pred) return null;
      j = skipWsAndComments(s, pred.end);
      const obj = readTermLikeAt(s, j);
      if (!obj) return null;
      j = skipWsAndComments(s, obj.end);
      if (s[j] !== '~' && !s.startsWith('{|', j)) return null;

      let reifier = '';
      const annotationBlocks = [];
      while (j < s.length) {
        j = skipWsAndComments(s, j);
        if (s[j] === '~') {
          j += 1;
          j = skipWsAndComments(s, j);
          const term = readTermAt(s, j);
          if (term) {
            reifier = term.text;
            j = term.end;
          } else if (!reifier) {
            reifier = `_:rdfAnnotation${++generatedBlank}`;
          }
          continue;
        }
        if (s.startsWith('{|', j)) {
          const block = readAnnotationBlockAt(s, j);
          const inner = block.inner.trim();
          if (!inner) throw new N3SyntaxError('Empty RDF annotation block is not allowed');
          if (!reifier) reifier = `_:rdfAnnotation${++generatedBlank}`;
          annotationBlocks.push(inner);
          j = block.end;
          continue;
        }
        break;
      }

      const after = skipWsAndComments(s, j);
      if (!['.', ';', ',', '}'].includes(s[after])) return null;
      if (!reifier && annotationBlocks.length === 0) return null;

      const baseTriple = `${subj.text} ${pred.text} ${obj.text}`;
      const graph = `{ ${baseTriple} }`;
      const extra = [];
      if (reifier) extra.push(`${reifier} ${RDF_REIFIES_IRI} ${graph} .`);
      for (const inner of annotationBlocks) {
        if (inner) extra.push(`${reifier} ${inner} .`);
      }

      let continuation = '';
      if (s[after] === ';') continuation = `\n${subj.text} `;
      else if (s[after] === ',') continuation = `\n${subj.text} ${pred.text} `;

      return {
        start,
        end: s[after] === '}' ? after : after + 1,
        text: `${baseTriple} .${extra.length ? '\n' + extra.join('\n') : ''}${continuation}`,
      };
    }

    while (i < s.length) {
      if (statementStart) {
        const converted = tryReadAnnotatedTriple(i);
        if (converted) {
          out += s.slice(i, converted.start) + converted.text;
          i = converted.end;
          statementStart = true;
          continue;
        }
      }

      const ch = s[i];
      if (ch === '"' || ch === "'") {
        const str = readStringAt(s, i);
        out += str.text;
        i = str.end;
        continue;
      }
      if (ch === '<' && !s.startsWith('<<', i)) {
        const iri = readIriAt(s, i);
        out += iri.text;
        i = iri.end;
        continue;
      }
      if (ch === '#') {
        while (i < s.length) {
          const c = s[i++];
          out += c;
          if (c === '\n' || c === '\r') break;
        }
        statementStart = true;
        continue;
      }
      out += ch;
      if (ch === '.' || ch === '{' || ch === '}' || ch === '\n' || ch === '\r') statementStart = true;
      else if (!/\s/.test(ch)) statementStart = false;
      i += 1;
    }

    return out;
  }

  function stripVersionDirectives(s) {
    return s.replace(/^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)(?:-messages)?\1\s*\.?\s*(?:#.*)?$/gim, '');
  }

  function skipWsAndComments(s, at) {
    let i = at;
    while (i < s.length) {
      if (/\s/.test(s[i])) {
        i += 1;
        continue;
      }
      if (s[i] === '#') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
        continue;
      }
      break;
    }
    return i;
  }

  function readTermAt(s, at) {
    if (s[at] === '<') return readIriAt(s, at);
    let i = at;
    while (i < s.length && !/\s/.test(s[i]) && !'{}[](),;.'.includes(s[i])) i += 1;
    if (i === at) return null;
    const value = s.slice(at, i);
    if (!value || value.startsWith('@')) return null;
    return { text: value, end: i };
  }

  function readBalancedBlock(s, at) {
    if (s[at] !== '{') return null;
    let i = at;
    let depth = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        i = readStringAt(s, i).end;
        continue;
      }
      if (ch === '<') {
        i = readIriAt(s, i).end;
        continue;
      }
      if (ch === '#') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
        continue;
      }
      if (s.startsWith('{|', i)) {
        i += 2;
        while (i < s.length) {
          if (s[i] === '"' || s[i] === "'") {
            i = readStringAt(s, i).end;
            continue;
          }
          if (s[i] === '<' && !s.startsWith('<<', i)) {
            i = readIriAt(s, i).end;
            continue;
          }
          if (s[i] === '#') {
            while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
            continue;
          }
          if (s.startsWith('|}', i)) {
            i += 2;
            break;
          }
          i += 1;
        }
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        i += 1;
        if (depth === 0) return { text: s.slice(at, i), inner: s.slice(at + 1, i - 1), end: i };
        continue;
      }
      i += 1;
    }
    throw new N3SyntaxError('Unterminated RDF/TriG graph block, expected }');
  }

  function normalizeNamedGraphs(s) {
    let out = '';
    let i = 0;
    let statementStart = true;
    let braceDepth = 0;

    while (i < s.length) {
      if (statementStart && braceDepth === 0) {
        const termStart = skipWsAndComments(s, i);
        out += s.slice(i, termStart);
        i = termStart;

        // Preserve directives and keep the scanner at statement-start for
        // following TriG graph blocks. SPARQL-style PREFIX/BASE/VERSION lines
        // have no trailing '.', while @prefix/@base/@version directives do.
        if (startsWordAt(s, 'PREFIX', i) || startsWordAt(s, 'BASE', i) || startsWordAt(s, 'VERSION', i)) {
          let end = i;
          while (end < s.length && s[end] !== '\n' && s[end] !== '\r') end += 1;
          out += s.slice(i, end);
          i = end;
          statementStart = true;
          continue;
        }
        if (s[i] === '@') {
          const lower = s.slice(i, i + 9).toLowerCase();
          if (lower.startsWith('@prefix') || lower.startsWith('@base') || lower.startsWith('@version')) {
            const end = skipOldStyleDirective(s, i);
            out += s.slice(i, end);
            i = end;
            statementStart = true;
            continue;
          }
        }

        // Top-level TriG default graph block: { ... } .
        if (s[i] === '{') {
          const block = readBalancedBlock(s, i);
          const after = skipWsAndComments(s, block.end);
          if (after >= s.length || s[after] === '.') {
            out += block.inner.trim();
            if (block.inner.trim() && !/\n$/.test(block.inner)) out += '\n';
            i = after < s.length && s[after] === '.' ? after + 1 : after;
            statementStart = true;
            continue;
          }
          // It is an ordinary N3 formula subject, not a TriG default graph.
          out += block.text;
          i = block.end;
          statementStart = false;
          continue;
        }

        let graphKeyword = false;
        if (startsWordAt(s, 'GRAPH', i)) {
          graphKeyword = true;
          i += 'GRAPH'.length;
          i = skipWsAndComments(s, i);
        }

        const term = readTermAt(s, i);
        if (term && !['@prefix', '@base', 'PREFIX', 'BASE', 'VERSION'].includes(term.text)) {
          const afterTerm = skipWsAndComments(s, term.end);
          if (s[afterTerm] === '{') {
            const block = readBalancedBlock(s, afterTerm);
            const afterBlock = skipWsAndComments(s, block.end);
            out += `${term.text} ${LOG_NAME_OF_IRI} ${block.text} .`;
            i = afterBlock < s.length && s[afterBlock] === '.' ? afterBlock + 1 : block.end;
            statementStart = true;
            continue;
          }
        }

        // Not TriG named-graph syntax after all; copy the first character and
        // continue as ordinary N3.
        if (graphKeyword) {
          out += 'GRAPH ';
          statementStart = false;
        } else if (i < s.length) {
          const copied = s[i++];
          out += copied;
          if (!/\s/.test(copied)) statementStart = false;
        }
      } else {
        const ch = s[i];
        out += ch;
        if (ch === '"' || ch === "'") {
          const str = readStringAt(s, i);
          out = out.slice(0, -1) + str.text;
          i = str.end;
          continue;
        }
        if (ch === '<') {
          const iri = readIriAt(s, i);
          out = out.slice(0, -1) + iri.text;
          i = iri.end;
          continue;
        }
        if (ch === '#') {
          i += 1;
          while (i < s.length) {
            const c = s[i++];
            out += c;
            if (c === '\n' || c === '\r') break;
          }
          continue;
        }
        if (ch === '{') braceDepth += 1;
        else if (ch === '}' && braceDepth > 0) braceDepth -= 1;
        else if (ch === '.' && braceDepth === 0) statementStart = true;
        else if (!/\s/.test(ch)) statementStart = false;
        i += 1;
      }
    }

    return out;
  }


  function isOnlyWhitespaceAndComments(s) {
    return skipWsAndComments(s, 0) >= s.length;
  }


  function skipOldStyleDirective(s, at) {
    let i = at;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        i = readStringAt(s, i).end;
        continue;
      }
      if (ch === '<') {
        i = readIriAt(s, i).end;
        continue;
      }
      if (ch === '#') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
        continue;
      }
      i += 1;
      if (ch === '.') return i;
    }
    return i;
  }

  function stripDirectivesAndCommentsForEmptiness(s) {
    let out = '';
    let i = 0;
    let statementStart = true;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        const str = readStringAt(s, i);
        out += str.text;
        i = str.end;
        statementStart = false;
        continue;
      }
      if (ch === '<') {
        const iri = readIriAt(s, i);
        out += iri.text;
        i = iri.end;
        statementStart = false;
        continue;
      }
      if (ch === '#') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
        statementStart = true;
        continue;
      }
      if (statementStart) {
        const start = skipWsAndComments(s, i);
        out += s.slice(i, start);
        i = start;
        if (startsWordAt(s, 'PREFIX', i) || startsWordAt(s, 'BASE', i) || startsWordAt(s, 'VERSION', i)) {
          while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
          statementStart = true;
          continue;
        }
        if (s[i] === '@') {
          const lower = s.slice(i, i + 9).toLowerCase();
          if (lower.startsWith('@prefix') || lower.startsWith('@base') || lower.startsWith('@version')) {
            i = skipOldStyleDirective(s, i);
            statementStart = true;
            continue;
          }
        }
      }
      out += ch;
      if (ch === '.' || ch === '}' || ch === '\n' || ch === '\r') statementStart = true;
      else if (!/\s/.test(ch)) statementStart = false;
      i += 1;
    }
    return out;
  }

  function simpleHashText(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function rewriteMessageBlankLabels(s, messageIndex) {
    let out = '';
    let i = 0;
    const prefix = `_:eyeling_m${String(messageIndex).padStart(3, '0')}_`;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        const str = readStringAt(s, i);
        out += str.text;
        i = str.end;
        continue;
      }
      if (ch === '<' && !s.startsWith('<<', i)) {
        const iri = readIriAt(s, i);
        out += iri.text;
        i = iri.end;
        continue;
      }
      if (ch === '#') {
        while (i < s.length) {
          const c = s[i++];
          out += c;
          if (c === '\n' || c === '\r') break;
        }
        continue;
      }
      if (s.startsWith('_:', i)) {
        let j = i + 2;
        while (j < s.length && !/\s/.test(s[j]) && !'{}[](),;.'.includes(s[j])) j += 1;
        const label = s.slice(i + 2, j);
        if (label) {
          out += prefix + label.replace(/[^A-Za-z0-9_]/g, '_');
          i = j;
          continue;
        }
      }
      out += ch;
      i += 1;
    }
    return out;
  }

  function findMessageDirectiveAt(s, at) {
    if (startsWordAt(s, 'MESSAGE', at)) return { start: at, end: at + 'MESSAGE'.length };
    if (s.slice(at, at + 8).toLowerCase() === '@message' && !isWordChar(s[at + 8])) {
      let end = at + 8;
      end = skipWsAndComments(s, end);
      if (s[end] === '.') end += 1;
      return { start: at, end };
    }
    return null;
  }

  function splitRdfMessageLog(s) {
    const chunks = [];
    let i = 0;
    let start = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let statementStart = true;
    let sawDelimiter = false;

    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        i = readStringAt(s, i).end;
        statementStart = false;
        continue;
      }
      if (ch === '<' && !s.startsWith('<<', i)) {
        i = readIriAt(s, i).end;
        statementStart = false;
        continue;
      }
      if (ch === '#') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i += 1;
        statementStart = true;
        continue;
      }
      if (statementStart && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        const termStart = skipWsAndComments(s, i);
        const msg = findMessageDirectiveAt(s, termStart);
        if (msg) {
          chunks.push(s.slice(start, termStart));
          start = msg.end;
          i = msg.end;
          statementStart = true;
          sawDelimiter = true;
          continue;
        }
        if (termStart !== i) {
          i = termStart;
          continue;
        }
      }
      if (ch === '{') braceDepth += 1;
      else if (ch === '}' && braceDepth > 0) braceDepth -= 1;
      else if (ch === '[') bracketDepth += 1;
      else if (ch === ']' && bracketDepth > 0) bracketDepth -= 1;
      else if (ch === '(') parenDepth += 1;
      else if (ch === ')' && parenDepth > 0) parenDepth -= 1;

      if (ch === '.' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) statementStart = true;
      else if (ch === '\n' || ch === '\r') statementStart = true;
      else if (!/\s/.test(ch)) statementStart = false;
      i += 1;
    }

    const tail = s.slice(start);
    if (!sawDelimiter || !isOnlyWhitespaceAndComments(tail)) chunks.push(tail);
    return chunks;
  }

  function normalizeMessageChunk(chunk, messageIndex) {
    let body = String(chunk || '');
    if (hasTripleTerms || body.includes('<<')) body = convertTripleTerms(body);
    if (hasAnnotationSyntax || /(?:^|\s)~|\{\|/.test(body)) {
      body = convertAnnotations(body);
    }
    body = normalizeNamedGraphs(body);
    body = rewriteMessageBlankLabels(body, messageIndex);
    return body.trim();
  }

  function messageChunkHasRdf(body) {
    return !isOnlyWhitespaceAndComments(stripDirectivesAndCommentsForEmptiness(body));
  }

  function normalizeRdfMessageLog(s) {
    const withoutVersion = stripVersionDirectives(s);
    const chunks = splitRdfMessageLog(withoutVersion);
    const hash = simpleHashText(s);
    const base = `urn:eyeling:message-log:${hash}`;
    const stream = `<${base}#stream>`;
    const envelopeIris = chunks.map((unused, idx) => `<${base}#m${String(idx + 1).padStart(3, '0')}>`);
    const payloadIris = chunks.map((unused, idx) => `<${base}#m${String(idx + 1).padStart(3, '0')}/payload>`);
    const out = [];

    out.push(`${stream} ${RDF_TYPE_IRI} ${EYMSG.RDFMessageStream} .`);
    out.push(`${stream} ${EYMSG.messageCount} "${chunks.length}"^^${XSD_INTEGER_IRI} .`);
    if (envelopeIris.length) {
      out.push(`${stream} ${EYMSG.orderedEnvelopes} (${envelopeIris.join(' ')}) .`);
      out.push(`${stream} ${EYMSG.firstEnvelope} ${envelopeIris[0]} .`);
      out.push(`${stream} ${EYMSG.lastEnvelope} ${envelopeIris[envelopeIris.length - 1]} .`);
    }

    for (let idx = 0; idx < chunks.length; idx += 1) {
      const n = idx + 1;
      const envelope = envelopeIris[idx];
      const payload = payloadIris[idx];
      const body = normalizeMessageChunk(chunks[idx], n);
      const hasBody = messageChunkHasRdf(body);

      out.push(`${stream} ${EYMSG.envelope} ${envelope} .`);
      out.push(`${envelope} ${RDF_TYPE_IRI} ${EYMSG.MessageEnvelope} .`);
      out.push(`${envelope} ${EYMSG.offset} "${n}"^^${XSD_INTEGER_IRI} .`);
      out.push(`${envelope} ${EYMSG.payloadKind} ${hasBody ? EYMSG.nonEmpty : EYMSG.empty} .`);
      if (idx + 1 < envelopeIris.length) out.push(`${envelope} ${EYMSG.nextEnvelope} ${envelopeIris[idx + 1]} .`);
      if (hasBody) {
        out.push(`${envelope} ${EYMSG.payloadGraph} ${payload} .`);
        out.push(`${payload} ${LOG_NAME_OF_IRI} {`);
        out.push(body);
        out.push(`} .`);
      }
    }

    return out.join('\n') + '\n';
  }

  if (hasMessageVersionDirective) return normalizeRdfMessageLog(text);

  if (hasTripleTerms) text = convertTripleTerms(text);
  if (hasAnnotationSyntax) text = convertAnnotations(text);
  if (hasVersionDirective || hasMessageVersionDirective) text = stripVersionDirectives(text);
  if (hasVersionDirective || hasMessageVersionDirective || hasNamedGraphCandidate) text = normalizeNamedGraphs(text);
  return text;
}


function isNumericLikeIdentifier(word) {
  if (typeof word !== 'string' || word.length === 0) return false;
  for (let j = 0; j < word.length; j++) {
    const code = word.charCodeAt(j);
    if (!((code >= 48 && code <= 57) || code === 46 || code === 45)) return false;
  }
  return true;
}

function lex(inputText, opts = {}) {
  const rdf = !!(opts && opts.rdf);
  if (rdf) inputText = normalizeRdfCompatibility(inputText);
  // Avoid copying large ASCII/BMP inputs into an Array.  Array.from() is
  // only needed when the text contains surrogate pairs and we want the old
  // code-point iteration behavior for non-BMP characters.
  const hasSurrogates = /[\uD800-\uDFFF]/.test(inputText);
  const inputMayContainInvalidStringChar = hasSurrogates || /[\u0000\uFFFE\uFFFF]/.test(inputText);
  const chars = hasSurrogates ? Array.from(inputText) : inputText;
  const n = chars.length;
  let i = 0;
  const tokens = [];

  function peek(offset = 0) {
    const j = i + offset;
    return j >= 0 && j < n ? chars[j] : null;
  }

  // Read an identifier-like token (prefixed name / blank node id / keyword).
  // Implements the relevant bits of the N3/Turtle grammar for PNAME_*:
  // - Accepts Unicode PN_CHARS*, ':' in local part, and '_' etc.
  // - Accepts percent escapes (%HH) as PLX fragments.
  // - Accepts PN_LOCAL_ESC backslash escapes and decodes them ("\\." -> ".").
  // - Accepts '.' inside a name only when it is not terminal.
  function sliceChars(start, end) {
    return typeof chars === 'string' ? chars.slice(start, end) : chars.slice(start, end).join('');
  }

  function readIdentText(startOffsetForErrors) {
    const start = i;
    let out = null;

    function appendRawUntilHere() {
      if (out === null) out = [sliceChars(start, i)];
    }

    while (i < n) {
      const cc = chars[i];
      if (cc === null || cc === undefined || isWs(cc)) break;

      // Hard stops: delimiters cannot appear unescaped inside PNAME tokens.
      if (cc === '{' || cc === '}' || cc === '(' || cc === ')' || cc === '[' || cc === ']' || cc === ';' || cc === ',') break;

      const code = cc.charCodeAt(0);

      // Common ASCII QName/identifier characters. Keep this branch inline so
      // ordinary N3 files do not call through the full Unicode PN_CHARS predicate
      // for every character.
      if (
        code === 58 || // ':'
        code === 95 || // '_'
        code === 45 || // '-'
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122)
      ) {
        if (out !== null) out.push(cc);
        i++;
        continue;
      }

      // Dot is allowed inside PN_LOCAL, but not at the end.
      if (cc === '.') {
        const next = peek(1);
        if (next === null) break;
        const ncode = next.charCodeAt(0);
        if (
          next === '%' ||
          next === '\\' ||
          ncode === 58 ||
          ncode === 95 ||
          ncode === 45 ||
          (ncode >= 48 && ncode <= 57) ||
          (ncode >= 65 && ncode <= 90) ||
          (ncode >= 97 && ncode <= 122) ||
          isIdentChar(next)
        ) {
          if (out !== null) out.push('.');
          i++;
          continue;
        }
        break;
      }

      // Percent escape: %HH
      if (cc === '%') {
        const h1 = peek(1);
        const h2 = peek(2);
        if (!isHexDigit(h1) || !isHexDigit(h2)) {
          throw new N3SyntaxError(
            'Invalid percent escape in prefixed name (expected %HH)',
            typeof startOffsetForErrors === 'number' ? startOffsetForErrors : i,
          );
        }
        appendRawUntilHere();
        out.push('%', h1, h2);
        i += 3;
        continue;
      }

      // Backslash escape in PN_LOCAL (PN_LOCAL_ESC)
      if (cc === '\\') {
        const esc = peek(1);
        if (esc !== null && PN_LOCAL_ESC_SET.has(esc)) {
          appendRawUntilHere();
          out.push(esc); // decoded form
          i += 2;
          continue;
        }
        throw new N3SyntaxError(
          'Invalid local name escape (use \\_ \\~ \\. \\- ... per N3 grammar)',
          typeof startOffsetForErrors === 'number' ? startOffsetForErrors : i,
        );
      }

      if (isIdentChar(cc)) {
        if (out !== null) out.push(cc);
        i++;
        continue;
      }

      break;
    }
    return out === null ? sliceChars(start, i) : out.join('');
  }

  while (i < n) {
    const c = peek();
    if (c === null) break;

    // 1) Whitespace
    if (isWs(c)) {
      i++;
      continue;
    }

    // 2) Comments starting with '#'
    if (c === '#') {
      while (i < n && chars[i] !== '\n' && chars[i] !== '\r') i++;
      continue;
    }

    // 3) Two-character operators: => and <=
    if (c === '=') {
      if (peek(1) === '>') {
        tokens.push(new Token('OpImplies', null, i));
        i += 2;
        continue;
      } else {
        // N3 syntactic sugar: '=' means owl:sameAs
        tokens.push(new Token('Equals', null, i));
        i += 1;
        continue;
      }
    }

    if (c === '<') {
      if (peek(1) === '=') {
        tokens.push(new Token('OpImpliedBy', null, i));
        i += 2;
        continue;
      }
      // N3 predicate inversion: "<-" (swap subject/object for this predicate)
      if (peek(1) === '-') {
        tokens.push(new Token('OpPredInvert', null, i));
        i += 2;
        continue;
      }
      // Otherwise IRIREF <...>
      const start = i;
      i++; // skip '<'
      const iriChars = [];
      while (i < n && chars[i] !== '>') {
        iriChars.push(chars[i]);
        i++;
      }
      if (i >= n || chars[i] !== '>') {
        throw new N3SyntaxError('Unterminated IRI <...>', start);
      }
      i++; // skip '>'
      const iri = decodeIriRefEscapes(iriChars.join(''), start);
      tokens.push(new Token('IriRef', iri, start));
      continue;
    }

    // 4) Path + datatype operators: !, ^, ^^
    if (c === '!') {
      tokens.push(new Token('OpPathFwd', null, i));
      i += 1;
      continue;
    }
    if (c === '^') {
      if (peek(1) === '^') {
        tokens.push(new Token('HatHat', null, i));
        i += 2;
        continue;
      }
      tokens.push(new Token('OpPathRev', null, i));
      i += 1;
      continue;
    }

    // 5) Single-character punctuation.  Use a switch rather than allocating a
    // mapping object for every punctuation token in large inputs.
    switch (c) {
      case '{':
        tokens.push(new Token('LBrace', null, i));
        i++;
        continue;
      case '}':
        tokens.push(new Token('RBrace', null, i));
        i++;
        continue;
      case '(':
        tokens.push(new Token('LParen', null, i));
        i++;
        continue;
      case ')':
        tokens.push(new Token('RParen', null, i));
        i++;
        continue;
      case '[':
        tokens.push(new Token('LBracket', null, i));
        i++;
        continue;
      case ']':
        tokens.push(new Token('RBracket', null, i));
        i++;
        continue;
      case ';':
        tokens.push(new Token('Semicolon', null, i));
        i++;
        continue;
      case ',':
        tokens.push(new Token('Comma', null, i));
        i++;
        continue;
      case '.':
        tokens.push(new Token('Dot', null, i));
        i++;
        continue;
      default:
        break;
    }

    // String literal: short "..." or long """..."""
    if (c === '"') {
      const start = i;

      // Long string literal """ ... """
      if (peek(1) === '"' && peek(2) === '"') {
        i += 3; // consume opening """
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];

          // Preserve escapes verbatim (same behavior as short strings)
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\');
              sChars.push(esc);
            } else {
              sChars.push('\\');
            }
            continue;
          }

          // In long strings, a run of >= 3 delimiter quotes terminates the literal.
          // Any extra quotes beyond the final 3 are part of the content.
          if (cc === '"') {
            let run = 0;
            while (i + run < n && chars[i + run] === '"') run++;

            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push('"');
              i += run; // consume content quotes (if any) + closing delimiter
              closed = true;
              break;
            }

            for (let k = 0; k < run; k++) sChars.push('"');
            i += run;
            continue;
          }

          sChars.push(cc);
          i++;
        }
        if (!closed) throw new N3SyntaxError('Unterminated long string literal """..."""', start);
        const raw = '"""' + sChars.join('') + '"""';
        const decoded = decodeN3StringEscapes(stripQuotes(raw), start);
        assertValidStringLiteralValue(decoded, start);
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal " ... ".  Most data files contain plain
      // unescaped labels; keep that path slice-based and avoid building an
      // intermediate character array + raw quoted string.
      i++; // consume opening "
      const contentStart = i;
      let sChars = null;
      let closed = false;
      while (i < n) {
        const cc = chars[i];
        i++;
        if (cc === '\\') {
          if (sChars === null) sChars = [sliceChars(contentStart, i - 1)];
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          } else {
            sChars.push('\\');
          }
          continue;
        }
        if (cc === '"') {
          closed = true;
          break;
        }
        if (sChars !== null) sChars.push(cc);
      }
      const rawContent = sChars === null ? sliceChars(contentStart, closed ? i - 1 : i) : sChars.join('');
      const decoded = sChars === null ? rawContent : decodeN3StringEscapes(rawContent, start);
      if (sChars !== null || inputMayContainInvalidStringChar) assertValidStringLiteralValue(decoded, start);
      const s = JSON.stringify(decoded); // canonical short quoted form
      tokens.push(new Token('Literal', s, start));
      continue;
    }

    // String literal: short '...' or long '''...'''
    if (c === "'") {
      const start = i;

      // Long string literal ''' ... '''
      if (peek(1) === "'" && peek(2) === "'") {
        i += 3; // consume opening '''
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];

          // Preserve escapes verbatim (same behavior as short strings)
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\');
              sChars.push(esc);
            } else {
              sChars.push('\\');
            }
            continue;
          }

          // In long strings, a run of >= 3 delimiter quotes terminates the literal.
          // Any extra quotes beyond the final 3 are part of the content.
          if (cc === "'") {
            let run = 0;
            while (i + run < n && chars[i + run] === "'") run++;

            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push("'");
              i += run; // consume content quotes (if any) + closing delimiter
              closed = true;
              break;
            }

            for (let k = 0; k < run; k++) sChars.push("'");
            i += run;
            continue;
          }

          sChars.push(cc);
          i++;
        }
        if (!closed) throw new N3SyntaxError("Unterminated long string literal '''...'''", start);
        const raw = "'''" + sChars.join('') + "'''";
        const decoded = decodeN3StringEscapes(stripQuotes(raw), start);
        assertValidStringLiteralValue(decoded, start);
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal ' ... '
      i++; // consume opening '
      const contentStart = i;
      let sChars = null;
      let closed = false;
      while (i < n) {
        const cc = chars[i];
        i++;
        if (cc === '\\') {
          if (sChars === null) sChars = [sliceChars(contentStart, i - 1)];
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          } else {
            sChars.push('\\');
          }
          continue;
        }
        if (cc === "'") {
          closed = true;
          break;
        }
        if (sChars !== null) sChars.push(cc);
      }
      const rawContent = sChars === null ? sliceChars(contentStart, closed ? i - 1 : i) : sChars.join('');
      const decoded = sChars === null ? rawContent : decodeN3StringEscapes(rawContent, start);
      if (sChars !== null || inputMayContainInvalidStringChar) assertValidStringLiteralValue(decoded, start);
      const s = JSON.stringify(decoded); // canonical short quoted form
      tokens.push(new Token('Literal', s, start));
      continue;
    }

    // Variable ?name
    if (c === '?') {
      const start = i;
      i++;
      const name = readIdentText(start);
      if (!name) {
        throw new N3SyntaxError("Expected variable name after '?'.", start);
      }
      tokens.push(new Token('Var', name, start));
      continue;
    }

    // Directives: @prefix, @base (and language tags after string literals)
    if (c === '@') {
      const start = i;
      const prevTok = tokens.length ? tokens[tokens.length - 1] : null;
      const prevWasQuotedLiteral =
        prevTok && prevTok.typ === 'Literal' && typeof prevTok.value === 'string' && prevTok.value.startsWith('"');

      i++; // consume '@'

      if (prevWasQuotedLiteral) {
        // N3 grammar production LANGTAG:
        //   "@" [a-zA-Z]+ ("-" [a-zA-Z0-9]+)*
        const tagChars = [];
        let cc = peek();
        if (cc === null || !isAsciiAlpha(cc)) {
          throw new N3SyntaxError("Invalid language tag (expected [A-Za-z] after '@')", start);
        }
        while ((cc = peek()) !== null && isAsciiAlpha(cc)) {
          tagChars.push(cc);
          i++;
        }
        while (peek() === '-') {
          if (peek(1) === '-') {
            const dir = sliceChars(i + 2, i + 5);
            const afterDir = peek(5);
            if ((dir === 'ltr' || dir === 'rtl') && (afterDir === null || !/[A-Za-z0-9-]/.test(afterDir))) {
              tagChars.push('--', dir);
              i += 5;
              break;
            }
            throw new N3SyntaxError('Invalid language direction (expected --ltr or --rtl)', start);
          }

          tagChars.push('-');
          i++; // consume '-'
          const segChars = [];
          while ((cc = peek()) !== null && /[A-Za-z0-9]/.test(cc)) {
            segChars.push(cc);
            i++;
          }
          if (!segChars.length) {
            throw new N3SyntaxError("Invalid language tag (expected [A-Za-z0-9]+ after '-')", start);
          }
          tagChars.push(...segChars);
        }
        tokens.push(new Token('LangTag', tagChars.join(''), start));
        continue;
      }

      // Otherwise, treat as a directive (@prefix, @base)
      const wordChars = [];
      let cc;
      while ((cc = peek()) !== null && isAsciiAlpha(cc)) {
        wordChars.push(cc);
        i++;
      }
      const word = wordChars.join('');
      if (word === 'prefix') tokens.push(new Token('AtPrefix', null, start));
      else if (word === 'base') tokens.push(new Token('AtBase', null, start));
      else throw new N3SyntaxError(`Unknown directive @${word}`, start);
      continue;
    }

    // 6) Numeric literal (integer or float)
    if (isAsciiDigit(c) || (c === '-' && peek(1) !== null && isAsciiDigit(peek(1)))) {
      const start = i;
      const numChars = [c];
      i++;
      while (i < n) {
        const cc = chars[i];
        if (isAsciiDigit(cc)) {
          numChars.push(cc);
          i++;
          continue;
        }
        if (cc === '.') {
          if (i + 1 < n && isAsciiDigit(chars[i + 1])) {
            numChars.push('.');
            i++;
            continue;
          } else {
            break;
          }
        }
        break;
      }

      // Optional exponent part: e.g., 1e0, 1.1e-3, 1.1E+0
      if (i < n && (chars[i] === 'e' || chars[i] === 'E')) {
        let j = i + 1;
        if (j < n && (chars[j] === '+' || chars[j] === '-')) j++;
        if (j < n && isAsciiDigit(chars[j])) {
          numChars.push(chars[i]); // e/E
          i++;
          if (i < n && (chars[i] === '+' || chars[i] === '-')) {
            numChars.push(chars[i]);
            i++;
          }
          while (i < n && isAsciiDigit(chars[i])) {
            numChars.push(chars[i]);
            i++;
          }
        }
      }

      tokens.push(new Token('Literal', numChars.join(''), start));
      continue;
    }

    // 7) Identifiers / keywords / QNames
    const start = i;
    const word = readIdentText(start);
    if (!word) {
      throw new N3SyntaxError(`Unexpected char: ${JSON.stringify(c)}`, i);
    }
    if (word === 'true' || word === 'false') {
      tokens.push(new Token('Literal', word, start));
    } else if (isNumericLikeIdentifier(word)) {
      tokens.push(new Token('Literal', word, start));
    } else {
      tokens.push(new Token('Ident', word, start));
    }
  }

  tokens.push(new Token('EOF', null, n));
  return tokens;
}

module.exports = { Token, N3SyntaxError, lex, normalizeRdfCompatibility, decodeN3StringEscapes };
