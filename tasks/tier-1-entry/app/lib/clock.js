// Single source of "now" so tests and jobs can pin the time.
let override = null;

module.exports = {
  now: () => (override !== null ? new Date(override) : new Date()),
  set: (value) => { override = value; },
  reset: () => { override = null; },
};
