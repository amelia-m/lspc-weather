// The line above the charts that names a row's days when they are few
// (docs/ceiling-heights.md, "The page says so"). The hours of one weather
// spell are not independent of each other, so a row from a few days
// describes those days, however many hours it holds. Apart from chart.js,
// and touching nothing on the page, so tests/ceilingErrorsPage.test.ts can
// run it on the data file's rows; chart.js calls it.
//
// Two weeks is this page's own line, not a published one. It sets no
// colour and judges no forecast: the note says what the dates are and why
// a few of them say little, and a row with no hours gets none.
const SHORT_SPAN_DAYS = 14;

function sampleNote(row) {
  if (!row.hours || !row.span) return null;
  // Calendar days in UTC, first and last included: 23:00 to 01:00 is two.
  const dayOf = (t) => Math.floor(Date.parse(t) / 86_400_000);
  const days = dayOf(row.span.to) - dayOf(row.span.from) + 1;
  if (days > SHORT_SPAN_DAYS) return null;
  const hours = row.hours === 1 ? 'This hour falls' : `These ${row.hours.toLocaleString('en-US')} hours fall`;
  const when = days === 1 ? `on one day, ${row.span.from.slice(0, 10)}` : `within ${days} days, ${row.span.from.slice(0, 10)} to ${row.span.to.slice(0, 10)}`;
  return `${hours} ${when}: a few weather spells at most, and the hours of one spell are not independent of each other, so these shares describe those days rather than how the forecast does in general.`;
}
