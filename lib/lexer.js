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
  return /\s/.test(c);
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
  return c !== null && /^[0-9A-Fa-f]$/.test(c);
}

function isPnCharsBase(c) {
  // Approximation of PN_CHARS_BASE from the N3 grammar using Unicode properties.
  // Covers most letters used in practice (including ñ) and common scripts.
  return c !== null && /[A-Za-z]|\p{L}|\p{Nl}/u.test(c);
}

function isPnCharsU(c) {
  // PN_CHARS_U ::= PN_CHARS_BASE | '_'
  return c === '_' || isPnCharsBase(c);
}

function isPnChars(c) {
  // PN_CHARS ::= PN_CHARS_U | '-' | [0-9] | U+00B7 | [U+0300-U+036F] | [U+203F-U+2040]
  if (c === null) return false;
  if (isPnCharsU(c)) return true;
  if (c === '-' || /[0-9]/.test(c) || c === '\u00B7') return true;
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

function canContinueAfterDot(next) {
  // PN_LOCAL allows '.' but it cannot appear at the end.
  // We include '.' only if it is followed by something that could continue a name.
  if (next === null) return false;
  if (isIdentChar(next)) return true;
  if (next === '%' || next === '\\') return true;
  return false;
}

function decodeN3StringEscapes(s) {
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
          out += String.fromCharCode(parseInt(hex, 16));
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
          if (cp >= 0 && cp <= 0x10ffff) out += String.fromCodePoint(cp);
          else out += '\\U' + hex;
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

function lex(inputText) {
  const chars = Array.from(inputText);
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
  function readIdentText(startOffsetForErrors) {
    const out = [];
    while (i < n) {
      const cc = peek();
      if (cc === null || isWs(cc)) break;

      // Hard stops: delimiters cannot appear unescaped inside PNAME tokens.
      if ('{}()[];,'.includes(cc)) break;

      // Dot is allowed inside PN_LOCAL, but not at the end.
      if (cc === '.') {
        if (!canContinueAfterDot(peek(1))) break;
        out.push('.');
        i++;
        continue;
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
        out.push('%', h1, h2);
        i += 3;
        continue;
      }

      // Backslash escape in PN_LOCAL (PN_LOCAL_ESC)
      if (cc === '\\') {
        const esc = peek(1);
        if (esc !== null && PN_LOCAL_ESC_SET.has(esc)) {
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
        out.push(cc);
        i++;
        continue;
      }

      break;
    }
    return out.join('');
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
      const iri = iriChars.join('');
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

    // 5) Single-character punctuation
    if ('{}()[];,.'.includes(c)) {
      const mapping = {
        '{': 'LBrace',
        '}': 'RBrace',
        '(': 'LParen',
        ')': 'RParen',
        '[': 'LBracket',
        ']': 'RBracket',
        ';': 'Semicolon',
        ',': 'Comma',
        '.': 'Dot',
      };
      tokens.push(new Token(mapping[c], null, i));
      i++;
      continue;
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
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal " ... "
      i++; // consume opening "
      const sChars = [];
      while (i < n) {
        const cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          }
          continue;
        }
        if (cc === '"') break;
        sChars.push(cc);
      }
      const raw = '"' + sChars.join('') + '"';
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
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
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal ' ... '
      i++; // consume opening '
      const sChars = [];
      while (i < n) {
        const cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          }
          continue;
        }
        if (cc === "'") break;
        sChars.push(cc);
      }
      const raw = "'" + sChars.join('') + "'";
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
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
        if (cc === null || !/[A-Za-z]/.test(cc)) {
          throw new N3SyntaxError("Invalid language tag (expected [A-Za-z] after '@')", start);
        }
        while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
          tagChars.push(cc);
          i++;
        }
        while (peek() === '-') {
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
      while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
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
    if (/[0-9]/.test(c) || (c === '-' && peek(1) !== null && /[0-9]/.test(peek(1)))) {
      const start = i;
      const numChars = [c];
      i++;
      while (i < n) {
        const cc = chars[i];
        if (/[0-9]/.test(cc)) {
          numChars.push(cc);
          i++;
          continue;
        }
        if (cc === '.') {
          if (i + 1 < n && /[0-9]/.test(chars[i + 1])) {
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
        if (j < n && /[0-9]/.test(chars[j])) {
          numChars.push(chars[i]); // e/E
          i++;
          if (i < n && (chars[i] === '+' || chars[i] === '-')) {
            numChars.push(chars[i]);
            i++;
          }
          while (i < n && /[0-9]/.test(chars[i])) {
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
    } else if ([...word].every((ch) => /[0-9.-]/.test(ch))) {
      tokens.push(new Token('Literal', word, start));
    } else {
      tokens.push(new Token('Ident', word, start));
    }
  }

  tokens.push(new Token('EOF', null, n));
  return tokens;
}

module.exports = { Token, N3SyntaxError, lex, decodeN3StringEscapes };
