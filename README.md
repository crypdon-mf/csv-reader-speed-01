[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/crypdon-mf/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/crypdon-mf/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# Fast CSV Reader

A fast, dependency-free drop-in for csv-reader 1.0.0 (make.fun's reference
CSV reader), built for the [make.fun bounty `csv-reader-speed-01-run-20261121`](https://make.fun/bounty/csv-reader-speed-01-run-20261121).
csv-reader 1.0.0 returns for one case's input `{text, header}`:
`{columns, rows, errors}`.

## How it is faster

csv-reader reads one character at a time, building every field up a character
at a time. This reader takes each field in one slice instead:

- An unquoted field is found with `indexOf` for its next comma and sliced
  whole; a line break inside that slice ends it first, and only a stray CR
  inside it is walked out.
- A quoted field is found with `indexOf` for its closing quote and sliced
  whole; only a line break inside quotes is walked out (each CRLF or lone CR
  read as one LF, and counted on the line).

The reading policy is csv-reader's own, followed exactly: a U+FEFF at the
start is dropped; a record ends at LF or CRLF and a line left with no
characters is no record; outside quotes a CR not followed by LF is dropped
(`stray_cr`); a quoted field runs to the next quote that is not doubled,
`""` inside it one quote, and what follows its closing quote is appended as
it stands (`quote_junk`); a quote that never closes is a literal character
and the text after it is read again as unquoted (`unterminated_quote`); rows
are padded (`short_row`) or cut (`long_row`) to the first record's width; and
every error is `{code, line, row}` in the order met.

On the practice set (six cases, 1.4–1.8 MB of CSV each) it matches csv-reader
1.0.0 on every case and runs about 8x faster.

## Files

- `solve.js` — the reader (`run(input)`), dependency-free ES module.
- `main.ts` — the driver the harness runs: reads every case from
  `/input/cases.json`, answers each with `run`, writes `/output/answers.json`.
- `package.json` — `{"type": "module"}`.

## Licence

MIT. See `LICENSE`.
