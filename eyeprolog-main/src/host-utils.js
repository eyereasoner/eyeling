// Shared conversions for module-specific library host adapters.
//
// Public library APIs stay in src/lib/*.pl.  Files named <module>-host.js
// should contain only runtime services that cannot be expressed portably in
// Prolog; this helper keeps their term/character conversions consistent.

import { ATOM, VAR, atom, compound, copyResolved, deref, listFromItems, properListItems } from './term.js';
import { PrologError } from './errors.js';

export function characterListText(term, env) {
  const value = deref(term, env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  const items = properListItems(value, env);
  if (items == null) throw new PrologError('type_error(list)', copyResolved(value, env));
  let text = '';
  for (const itemTerm of items) {
    const item = deref(itemTerm, env);
    if (item.type === VAR) throw new PrologError('instantiation_error');
    if (item.type !== ATOM || Array.from(item.name).length !== 1) {
      throw new PrologError('type_error(character)', copyResolved(item, env));
    }
    text += item.name;
  }
  return text;
}

export function chars(text) {
  return listFromItems(Array.from(String(text), atom));
}

export function listOfChars(values) {
  return listFromItems(values.map((value) => chars(value)));
}

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longMonths = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const longWeekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// EyeProlog's time stamp representation is the same key/value list consumed by
// library(time):format_time//2.  Keep all host-created timestamps identical.
export function dateTimeTerm(date) {
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  const dayOfYear = Math.floor((
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
    Date.UTC(date.getFullYear(), 0, 1)
  ) / 86400000) + 1;
  const entries = [
    ['Y', String(date.getFullYear())],
    ['m', pad(date.getMonth() + 1)],
    ['d', pad(date.getDate())],
    ['H', pad(date.getHours())],
    ['M', pad(date.getMinutes())],
    ['S', pad(date.getSeconds())],
    ['y', pad(date.getFullYear() % 100)],
    ['b', shortMonths[date.getMonth()]],
    ['B', longMonths[date.getMonth()]],
    ['a', shortWeekdays[date.getDay()]],
    ['A', longWeekdays[date.getDay()]],
    ['w', String(date.getDay())],
    ['u', String(date.getDay() === 0 ? 7 : date.getDay())],
    ['j', pad(dayOfYear, 3)],
  ].map(([key, value]) => compound('=', [atom(key), chars(value)]));
  return listFromItems(entries);
}
