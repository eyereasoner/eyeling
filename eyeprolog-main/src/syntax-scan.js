// Lightweight lexical helpers shared by the interactive and ISO stream
// readers. These locate token boundaries only; parser.js remains responsible
// for accepting or rejecting the token itself.

const graphicTokenCharacters = new Set('#$&*+-./<=>?@^~\\:');

export function continuesGraphicToken(source, index, convert = null) {
  if (index <= 0) return false;
  const rawPrevious = source[index - 1];
  const previous = convert == null ? rawPrevious : convert(rawPrevious);
  // Most full stops follow a non-graphic token. Reject those in O(1) before
  // doing the rarer character-code/comment disambiguation below; otherwise a
  // large source with many term-ending dots degenerates into repeated backward
  // scans (notably multi-megabyte generated data files).
  if (!graphicTokenCharacters.has(previous)) return false;

  // A graphic-looking character can be the payload or closing escape of a
  // character-code constant rather than a graphic token.  For example, the
  // backslash immediately before the full stop in `0'\x41\.` belongs to
  // the number token, so that full stop still terminates the term.
  const apostrophe = source.lastIndexOf("'", index - 1);
  if (apostrophe >= 0 && characterCodeConstantEnd(source, apostrophe) === index - 1) return false;
  // The slash that closes a bracketed comment is layout, not the tail of a
  // graphic token. Distinguish it from spellings such as `//*.*/`, where the
  // apparent /* is itself embedded in a graphic token and therefore never
  // opens a comment.
  if (source[index - 1] === '/' && source[index - 2] === '*') {
    for (let open = source.lastIndexOf('/*', index - 3); open >= 0;
         open = source.lastIndexOf('/*', open - 1)) {
      if (open === 0 || !graphicTokenCharacters.has(source[open - 1])) return false;
    }
  }
  return true;
}

export function isTerminatingFullStop(source, index, convert = null) {
  const current = convert == null ? source[index] : convert(source[index]);
  if (current !== '.') return false;
  const rawNext = source[index + 1] ?? '';
  const next = convert == null ? rawNext : convert(rawNext);
  // A full stop cannot terminate a term when it can still extend the graphic
  // token immediately before it. This remains true at a line boundary and at
  // the current end of interactive input: `*.\n` is the graphic token `*.`
  // followed by layout, so read/1 must keep waiting for a separate end char.
  // Conversely `!.\n` terminates because ! is a solo token, not a graphic
  // token character accepted by continuesGraphicToken().
  if (continuesGraphicToken(source, index, convert)) return false;
  if (next === '' || next === '%' || next === '\n' || next === '\r') return true;
  if (/^[\u0000-\u0020\u007f]$/.test(next)) return true;
  return false;
}

export function quotedEscapeEnd(source, index) {
  const escaped = source[index + 1] ?? '';
  if (!escaped) return index;

  if (escaped === '\n') return index + 1;
  if (escaped === '\r' && source[index + 2] === '\n') return index + 2;

  if (escaped === 'x') {
    let cursor = index + 2;
    while (/^[0-9A-Fa-f]$/.test(source[cursor] ?? '')) cursor++;
    return source[cursor] === '\\' ? cursor : Math.max(index + 1, cursor - 1);
  }
  if (/^[0-9]$/.test(escaped)) {
    let cursor = index + 1;
    // Include 8 and 9 while finding the boundary. The parser rejects them as
    // non-octal rather than letting the reader split the malformed token.
    while (/^[0-9]$/.test(source[cursor] ?? '')) cursor++;
    return source[cursor] === '\\' ? cursor : Math.max(index + 1, cursor - 1);
  }

  return index + 1;
}

export function characterCodeConstantEnd(source, apostropheIndex) {
  if (source[apostropheIndex] !== "'" || source[apostropheIndex - 1] !== '0') return null;
  // The 0 must begin a numeric token. In particular, do not reinterpret the
  // apostrophe in an identifier such as a0'x as character-code notation.
  if (/[A-Za-z0-9_]/.test(source[apostropheIndex - 2] ?? '')) return null;

  const characterIndex = apostropheIndex + 1;
  const character = source[characterIndex] ?? '';
  if (!character) return apostropheIndex;
  // `0''` is two tokens (0 and the empty atom), and `0'\\\n...'
  // likewise starts a quoted atom containing a continuation. Only `0'''`
  // denotes the character-code constant for an apostrophe.
  if (character === "'" && source[characterIndex + 1] !== "'") return null;
  if (character === '\\' && ['\n', '\r'].includes(source[characterIndex + 1])) return null;
  if (character === '\\') return quotedEscapeEnd(source, characterIndex);

  // An apostrophe character is doubled in 0''' exactly as it is in a quoted
  // atom. Consume both so neither one opens a quoted-token scan state.
  if (character === "'" && source[characterIndex + 1] === "'") return characterIndex + 1;

  const firstCode = character.charCodeAt(0);
  if (firstCode >= 0xd800 && firstCode <= 0xdbff) {
    const secondCode = source.charCodeAt(characterIndex + 1);
    if (secondCode >= 0xdc00 && secondCode <= 0xdfff) return characterIndex + 1;
  }
  return characterIndex;
}
