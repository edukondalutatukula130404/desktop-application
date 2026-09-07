/** Minimal --flag / --flag value / --flag=value parser. Booleans have no value. */
'use strict';

function parseArgs(argv, booleanFlags = []) {
  const out = { _: [] };
  const bool = new Set(booleanFlags);
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq !== -1) {
        out[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else {
        const key = tok.slice(2);
        if (bool.has(key)) {
          out[key] = true;
        } else {
          const next = argv[i + 1];
          if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
          else out[key] = true;
        }
      }
    } else {
      out._.push(tok);
    }
  }
  return out;
}

module.exports = { parseArgs };
