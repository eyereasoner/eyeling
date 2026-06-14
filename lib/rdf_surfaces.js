/**
 * Eyeling Reasoner — RDF Surfaces syntax normalizer
 *
 * Implements a small RDF Surfaces text convention inspired by Hayes' BLOGIC
 * slides: `%not[ ... %]` surface parentheses with explicit blank mark binders
 * such as `_:x _:y` at the beginning of a surface. The supported fragment
 * covers slide 32, the slide 33 range shape, both slide 33 allValuesFrom
 * shapes, and top-level fuse surfaces.
 *
 * The normalizer rewrites the supported fragment into ordinary Eyeling N3:
 *   %not[ _:x P(?x) . %not[ Q(?x) . %] %]
 * becomes:
 *   { P(?x) . } => { Q(?x) . } .
 *
 * A top-level negative surface without an inner negative surface becomes an
 * inference fuse:
 *   %not[ _:x P(?x) . %]
 * becomes:
 *   { P(?x) . } => false .
 */

'use strict';

function syntaxError(message, offset = null) {
  const e = new Error(message);
  e.name = 'N3SyntaxError';
  if (typeof offset === 'number') e.offset = offset;
  return e;
}

function isWs(ch) {
  return ch != null && /\s/.test(ch);
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
    throw syntaxError('Unterminated string literal inside RDF Surface', at);
  }

  i += 1;
  let escaped = false;
  while (i < s.length) {
    const ch = s[i++];
    out += ch;
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === quote) return { text: out, end: i };
  }
  throw syntaxError('Unterminated string literal inside RDF Surface', at);
}

function readIriAt(s, at) {
  let i = at + 1;
  let out = '<';
  while (i < s.length) {
    const ch = s[i++];
    out += ch;
    if (ch === '>') return { text: out, end: i };
  }
  throw syntaxError('Unterminated IRI inside RDF Surface', at);
}

function skipWsAndComments(s, at) {
  let i = at;
  while (i < s.length) {
    if (isWs(s[i])) {
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

function readBareTokenAt(s, at) {
  const i0 = skipWsAndComments(s, at);
  if (i0 >= s.length) return null;
  if (s[i0] === '<') return readIriAt(s, i0);
  if (s[i0] === '"' || s[i0] === "'") return readStringAt(s, i0);
  let i = i0;
  while (i < s.length && !isWs(s[i]) && !'{}[](),;.'.includes(s[i])) i += 1;
  if (i === i0) return null;
  return { text: s.slice(i0, i), start: i0, end: i };
}

function readStatementSegment(s) {
  let i = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let depthParen = 0;
  while (i < s.length) {
    if (s.startsWith('%not[', i) && depthBrace === 0 && depthBracket === 0 && depthParen === 0) {
      return s.slice(0, i);
    }
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
    if (ch === '{') depthBrace += 1;
    else if (ch === '}' && depthBrace > 0) depthBrace -= 1;
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']' && depthBracket > 0) depthBracket -= 1;
    else if (ch === '(') depthParen += 1;
    else if (ch === ')' && depthParen > 0) depthParen -= 1;
    else if (ch === '.' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) return s.slice(0, i);
    i += 1;
  }
  return s;
}

function tokenizeLeadingSegment(segment) {
  const toks = [];
  let pos = 0;
  while (pos < segment.length) {
    const tok = readBareTokenAt(segment, pos);
    if (!tok) break;
    toks.push(tok);
    pos = tok.end;
  }
  return toks;
}

function extractLeadingBinders(raw) {
  const text = String(raw || '');
  const contentStart = skipWsAndComments(text, 0);
  if (contentStart >= text.length) return { binders: [], text };

  // Preferred BLOGIC graffiti style: put newly bound marks on the `%not[`
  // line and put triples on following non-indented lines, e.g.
  // `%not[ _:x _:y\n_:x :p _:y .`.  Reading that first line directly
  // avoids guessing from the first triple shape, which matters for RDF 1.2
  // formula objects and TriG named graph blocks.
  let lineEnd = text.indexOf('\n', contentStart);
  if (lineEnd < 0) lineEnd = text.length;
  let lineText = text.slice(contentStart, lineEnd);
  let newlineEnd = lineEnd < text.length ? lineEnd + 1 : lineEnd;
  if (lineText.endsWith('\r')) {
    lineText = lineText.slice(0, -1);
  }
  const lineTrim = lineText.trim();
  if (/^_:[A-Za-z_][A-Za-z0-9._-]*(?:\s+_:[A-Za-z_][A-Za-z0-9._-]*)*$/.test(lineTrim)) {
    const binders = lineTrim.split(/\s+/).map((tok) => tok.slice(2));
    return { binders, text: text.slice(0, contentStart) + text.slice(newlineEnd) };
  }

  const segment = readStatementSegment(text.slice(contentStart));
  const toks = tokenizeLeadingSegment(segment);
  let leadingBlankCount = 0;
  while (leadingBlankCount < toks.length && /^_:[A-Za-z_][A-Za-z0-9._-]*$/.test(toks[leadingBlankCount].text)) {
    leadingBlankCount += 1;
  }

  if (leadingBlankCount === 0) return { binders: [], text };

  let binderCount = 0;
  if (toks.length >= 3) {
    // Prefer the longest explicit binder prefix that still leaves at least a
    // subject, predicate, and object for the first statement. This matches the
    // BLOGIC slide convention, e.g. `%not[ _:x _:x a :C . ... %]`.
    binderCount = Math.min(leadingBlankCount, Math.max(0, toks.length - 3));
  } else {
    // No own triple before a nested surface: treat the leading marks as binders.
    binderCount = leadingBlankCount;
  }

  if (binderCount <= 0) return { binders: [], text };

  const binders = toks.slice(0, binderCount).map((t) => t.text.slice(2));
  const cut = toks[binderCount - 1].end;
  return { binders, text: text.slice(0, contentStart) + text.slice(contentStart + cut) };
}


function readBalancedCurlyAt(s, at) {
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
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { text: s.slice(at, i + 1), end: i + 1 };
    }
    i += 1;
  }
  throw syntaxError('Unterminated named graph block inside RDF Surface', at);
}

function normalizeSurfaceStatement(statement) {
  const raw = String(statement || '').trim();
  if (!raw) return raw;

  let i = 0;
  const first = readBareTokenAt(raw, i);
  if (first && /^GRAPH$/i.test(first.text)) {
    i = first.end;
  }

  const term = readBareTokenAt(raw, i);
  if (!term) return raw;
  const afterTerm = skipWsAndComments(raw, term.end);
  if (raw[afterTerm] !== '{') return raw;

  const block = readBalancedCurlyAt(raw, afterTerm);
  const afterBlock = skipWsAndComments(raw, block.end);
  if (afterBlock !== raw.length) return raw;

  return `${term.text} ${LOG_NAME_OF_IRI} ${block.text}`;
}

function splitTopLevelStatements(raw, surfaceOffset = null) {
  const text = String(raw || '');
  const out = [];
  let start = 0;
  let i = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let depthParen = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = readStringAt(text, i).end;
      continue;
    }
    if (ch === '<') {
      i = readIriAt(text, i).end;
      continue;
    }
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
      continue;
    }
    if (ch === '{') depthBrace += 1;
    else if (ch === '}' && depthBrace > 0) depthBrace -= 1;
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']' && depthBracket > 0) depthBracket -= 1;
    else if (ch === '(') depthParen += 1;
    else if (ch === ')' && depthParen > 0) depthParen -= 1;
    else if (ch === '.' && depthBrace === 0 && depthBracket === 0 && depthParen === 0) {
      const stmt = text.slice(start, i).trim();
      if (stmt) out.push(normalizeSurfaceStatement(stmt));
      start = i + 1;
    }
    i += 1;
  }

  const tail = text.slice(start).trim();
  if (tail) {
    // A raw binder-only segment is OK; RDF 1.2 TriG named graph blocks are
    // also OK without a trailing dot. Any other dangling text is most likely a
    // missing dot in the surface body.
    const normalizedTail = normalizeSurfaceStatement(tail);
    if (normalizedTail !== tail) {
      out.push(normalizedTail);
    } else if (!/^_:[A-Za-z_][A-Za-z0-9._-]*(?:\s+_:[A-Za-z_][A-Za-z0-9._-]*)*$/.test(tail)) {
      throw syntaxError('RDF Surface statement is missing a terminating dot', surfaceOffset);
    }
  }

  return out;
}

function readSurfaceAt(s, at) {
  if (!s.startsWith('%not[', at)) return null;
  let i = at + '%not['.length;
  let current = '';
  const segments = [];
  const children = [];

  while (i < s.length) {
    if (s.startsWith('%]', i)) {
      segments.push(current);
      i += 2;
      const raw = segments.join('\n');
      const stripped = extractLeadingBinders(raw);
      return {
        type: 'not',
        start: at,
        end: i,
        binders: stripped.binders,
        statements: splitTopLevelStatements(stripped.text, at),
        children,
      };
    }

    if (s.startsWith('%not[', i)) {
      segments.push(current);
      current = '';
      const child = readSurfaceAt(s, i);
      children.push(child);
      i = child.end;
      continue;
    }

    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const str = readStringAt(s, i);
      current += str.text;
      i = str.end;
      continue;
    }
    if (ch === '<') {
      const iri = readIriAt(s, i);
      current += iri.text;
      i = iri.end;
      continue;
    }
    if (ch === '#') {
      while (i < s.length) {
        const c = s[i++];
        current += c;
        if (c === '\n' || c === '\r') break;
      }
      continue;
    }

    current += ch;
    i += 1;
  }

  throw syntaxError('Unterminated RDF Surface, expected %]', at);
}

const LOG_FOR_ALL_IN_IRI = '<http://www.w3.org/2000/10/swap/log#forAllIn>';
const LOG_NAME_OF_IRI = '<http://www.w3.org/2000/10/swap/log#nameOf>';

function rewriteBlankMarksWithMap(statement, labelToVarName) {
  const map = labelToVarName instanceof Map ? labelToVarName : new Map();
  let out = '';
  let i = 0;
  while (i < statement.length) {
    const ch = statement[i];
    if (ch === '"' || ch === "'") {
      const str = readStringAt(statement, i);
      out += str.text;
      i = str.end;
      continue;
    }
    if (ch === '<') {
      const iri = readIriAt(statement, i);
      out += iri.text;
      i = iri.end;
      continue;
    }
    if (ch === '#') {
      while (i < statement.length) {
        const c = statement[i++];
        out += c;
        if (c === '\n' || c === '\r') break;
      }
      continue;
    }
    if (statement.startsWith('_:', i)) {
      let j = i + 2;
      while (j < statement.length && !isWs(statement[j]) && !'{}[](),;.'.includes(statement[j])) j += 1;
      const label = statement.slice(i + 2, j);
      const mapped = label ? map.get(label) : null;
      if (mapped) {
        out += `?${mapped}`;
        i = j;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out.trim();
}

function formatGraphWithMap(statements, labelMap) {
  const body = (statements || [])
    .map((st) => rewriteBlankMarksWithMap(st, labelMap))
    .filter(Boolean)
    .map((st) => `  ${st} .`)
    .join('\n');
  return body ? `{
${body}\n}` : '{ }';
}

function formatGraphFromRewritten(statements) {
  const body = (statements || [])
    .map((st) => String(st || '').trim())
    .filter(Boolean)
    .map((st) => `  ${st} .`)
    .join('\n');
  return body ? `{
${body}\n}` : '{ }';
}

function makeVarMap(labels, prefix = '') {
  const map = new Map();
  for (const label of labels || []) map.set(label, `${prefix}${label}`);
  return map;
}

function mergeVarMaps(...maps) {
  const out = new Map();
  for (const m of maps) {
    for (const [k, v] of m.entries()) out.set(k, v);
  }
  return out;
}

function slide33ReverseAllValuesFromRule(node, inheritedMap = new Map(), extraPremises = []) {
  const outerBinders = node.binders || [];
  const own = node.statements || [];
  const children = node.children || [];

  if (own.length !== 0 || outerBinders.length === 0 || children.length !== 2) return null;

  let bodyChild = null;
  let headChild = null;
  for (const child of children) {
    const childChildren = child && child.children ? child.children : [];
    if (childChildren.length === 1) bodyChild = child;
    else if (childChildren.length === 0) headChild = child;
    else return null;
  }

  if (!bodyChild || !headChild) return null;
  if (!bodyChild.statements || bodyChild.statements.length === 0) return null;
  if (!headChild.statements || headChild.statements.length === 0) return null;

  const thenChild = bodyChild.children[0];
  if (!thenChild || (thenChild.children && thenChild.children.length)) return null;
  if (!thenChild.statements || thenChild.statements.length === 0) return null;

  const outerMap = mergeVarMaps(inheritedMap, makeVarMap(outerBinders));
  const witnessMap = makeVarMap(bodyChild.binders || [], '__rs_witness_');
  const localMap = makeVarMap(bodyChild.binders || [], '__rs_');

  const mappedExtra = (extraPremises || [])
    .map((st) => rewriteBlankMarksWithMap(st, outerMap))
    .filter(Boolean);
  const premiseStmts = bodyChild.statements
    .map((st) => rewriteBlankMarksWithMap(st, mergeVarMaps(outerMap, witnessMap)))
    .filter(Boolean);

  const whereGraph = formatGraphWithMap(bodyChild.statements, mergeVarMaps(outerMap, localMap));
  const thenGraph = formatGraphWithMap(thenChild.statements, mergeVarMaps(outerMap, localMap));
  const forAllLine = `( ${whereGraph} ${thenGraph} ) ${LOG_FOR_ALL_IN_IRI} 1`;

  const premise = formatGraphFromRewritten([...mappedExtra, ...premiseStmts, forAllLine]);
  const conclusion = formatGraphWithMap(headChild.statements, outerMap);
  return `${premise} => ${conclusion} .`;
}


function translateHeadSurface(node, extraPremises, inheritedMap = new Map()) {
  const rules = [];
  const map = inheritedMap instanceof Map ? inheritedMap : new Map();
  const own = node.statements || [];
  if (own.length) {
    rules.push(`${formatGraphWithMap(extraPremises, map)} => ${formatGraphWithMap(own, map)} .`);
  }
  for (const child of node.children || []) {
    rules.push(...translateRuleSurface(child, extraPremises, map));
  }
  return rules;
}

function translateRuleSurface(node, extraPremises = [], inheritedMap = new Map()) {
  const slide33Reverse = slide33ReverseAllValuesFromRule(node, inheritedMap, extraPremises);
  if (slide33Reverse) return [slide33Reverse];

  const map = mergeVarMaps(inheritedMap, makeVarMap(node.binders || []));
  const own = node.statements || [];
  const premise = [...(extraPremises || []), ...own];
  const children = node.children || [];

  if (children.length === 0) {
    return own.length ? [`${formatGraphWithMap(premise, map)} => false .`] : [];
  }

  return children.flatMap((child) => translateHeadSurface(child, premise, map));
}

function translateTopLevelSurface(node) {
  const map = makeVarMap(node.binders || []);
  const own = node.statements || [];

  if (!node.children || node.children.length === 0) {
    return own.length ? [`${formatGraphWithMap(own, map)} => false .`] : [];
  }

  const slide33Reverse = slide33ReverseAllValuesFromRule(node);
  if (slide33Reverse) return [slide33Reverse];

  return node.children.flatMap((child) => translateHeadSurface(child, own, map));
}

function normalizeRdfSurfaces(inputText) {
  const s = String(inputText ?? '');
  if (!s.includes('%not[')) return s;

  let out = '';
  const generated = [];
  let i = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  while (i < s.length) {
    if (s.startsWith('%not[', i) && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      const surface = readSurfaceAt(s, i);
      generated.push(...translateTopLevelSurface(surface));
      i = surface.end;
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

    if (ch === '{') braceDepth += 1;
    else if (ch === '}' && braceDepth > 0) braceDepth -= 1;
    else if (ch === '[') bracketDepth += 1;
    else if (ch === ']' && bracketDepth > 0) bracketDepth -= 1;
    else if (ch === '(') parenDepth += 1;
    else if (ch === ')' && parenDepth > 0) parenDepth -= 1;

    out += ch;
    i += 1;
  }

  if (generated.length === 0) return out;
  const sep = out.trim() ? (out.endsWith('\n') ? '\n' : '\n\n') : '';
  return out + sep + generated.join('\n\n') + '\n';
}

module.exports = {
  normalizeRdfSurfaces,
};
