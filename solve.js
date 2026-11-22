// Fast CSV reader: a drop-in for csv-reader 1.0.0 (make.fun's reference program).
// Returns, for one case's input {text, header}, exactly the answer csv-reader
// 1.0.0 returns: {columns, rows, errors}.
//
// Speed comes from reading fields in bulk instead of one character at a time:
// an unquoted field is found with indexOf for its next comma or line break and
// sliced whole; a quoted field is found with indexOf for its closing quote and
// sliced whole. Only the rare broken pieces (a stray CR, a line break inside
// quotes) are walked character by character. The reading policy is csv-reader's
// own, followed exactly:
//
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside a quoted field a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote, and each CRLF or lone CR inside it read as LF;
//     what follows its closing quote, up to the next comma or line break, is
//     appended as it stands (quote_junk, when the field ends); a quote that never
//     closes is a literal character, and the text after it is read again as
//     unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with ""
//     (short_row, with fields: its count) or cut (long_row, with extra: the cut
//     fields) to the first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts
//     on (every LF, CRLF and lone CR inside a quoted field counted), row its
//     record's index in rows (null for the header), in the order met.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the next.

const COMMA = 'comma';
const LINE_BREAK = 'line break';
const END = 'end';

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break:
  // a CR not followed by LF is dropped (stray_cr). Returns the field and how it
  // ended; `added` counts the characters kept. The field is taken in one slice
  // to its next comma; a line break inside that slice ends it first, and only a
  // stray CR inside it is walked out.
  function readUnquoted(value) {
    let added = 0;
    const cIdx = text.indexOf(',', pos);
    const end = cIdx === -1 ? len : cIdx;
    const seg = text.slice(pos, end);
    const nPos = seg.indexOf('\n');
    let fieldText, ended, nextPos;
    if (nPos !== -1) {
      ended = LINE_BREAK;
      nextPos = pos + nPos + 1;
      let contentLen = nPos;
      if (nPos > 0 && seg.charCodeAt(nPos - 1) === 13) contentLen = nPos - 1;
      fieldText = seg.slice(0, contentLen);
    } else {
      ended = cIdx === -1 ? END : COMMA;
      nextPos = cIdx === -1 ? len : cIdx + 1;
      fieldText = seg;
    }
    const rPos = fieldText.indexOf('\r');
    if (rPos === -1) {
      value += fieldText;
      added += fieldText.length;
    } else {
      // Stray CRs inside the field: drop each (one error each) and keep the rest.
      const parts = fieldText.split('\r');
      for (let i = 0; i < parts.length - 1; i++) error('stray_cr');
      const cleaned = parts.join('');
      value += cleaned;
      added += cleaned.length;
    }
    pos = nextPos;
    if (ended === LINE_BREAK) line += 1;
    return { value, ended, added };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let closed = false;
    while (pos < len) {
      const q = text.indexOf('"', pos);
      if (q === -1) break;
      if (q > pos) {
        const chunk = text.slice(pos, q);
        if (chunk.indexOf('\r') === -1 && chunk.indexOf('\n') === -1) {
          value += chunk;
        } else {
          // Line breaks inside quotes each read as one LF: CRLF and a lone CR
          // each one LF, and every one counted on the line.
          let start = 0;
          for (let i = 0; i < chunk.length; i++) {
            const ch = chunk.charCodeAt(i);
            if (ch === 13) {
              value += chunk.slice(start, i) + '\n';
              line += 1;
              if (chunk.charCodeAt(i + 1) === 10) i++;
              start = i + 1;
            } else if (ch === 10) {
              value += chunk.slice(start, i) + '\n';
              line += 1;
              start = i + 1;
            }
          }
          value += chunk.slice(start);
        }
      }
      if (text.charCodeAt(q + 1) === 34) {
        value += '"';
        pos = q + 2;
        continue;
      }
      pos = q + 1;
      closed = true;
      break;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: END };
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      if (text.charCodeAt(pos) === 10) {
        pos += 1;
        line += 1;
      } else if (text.charCodeAt(pos) === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
