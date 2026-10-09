/**
 * Rendered markup with the USPA SIM glossary links (SimTerm, class
 * "sim-term") taken out and their words left in place, so a test about what
 * a sentence says reads it whole whether or not a term in it is linked.
 * Every other tag stays, so an assertion about structure is unchanged. The
 * links themselves are tested in tests/simGlossary.test.ts.
 */
export const withoutGlossaryLinks = (html: string): string => html.replace(/<a class="sim-term"[^>]*>([^<]*)<\/a>/g, '$1');
