// Numeric value identity shared by term semantics and scalar indexes. Keep
// integer and float terms distinct while ignoring insignificant spelling
// differences within either ISO numeric type.
const decimalInteger = (text) => /^-?\d+$/.test(text ?? '');

const finiteFloat = (text) => {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text ?? '')) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

export function sameNumberValue(left, right) {
  const leftInteger = decimalInteger(left);
  const rightInteger = decimalInteger(right);
  if (leftInteger || rightInteger) {
    return leftInteger && rightInteger && BigInt(left) === BigInt(right);
  }
  const leftValue = finiteFloat(left);
  const rightValue = finiteFloat(right);
  return leftValue != null && rightValue != null && leftValue === rightValue;
}

export function numberValueKey(text) {
  if (decimalInteger(text)) return `integer:${BigInt(text)}`;
  const value = finiteFloat(text);
  if (value == null) return `invalid:${text}`;
  return `float:${Object.is(value, -0) ? 0 : value}`;
}
