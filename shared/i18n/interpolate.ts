/**
 * Fills a translated sentence's `%{name}` slots, so each language can place
 * values where its own grammar needs them (e.g. "%{completed} of %{total}"
 * vs. Urdu "%{total} میں سے %{completed}"). Unknown slots are left as-is.
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/%\{(\w+)\}/g, (slot, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : slot
  );
}

export interface InterpolatedSegment {
  text: string;
  /** The slot this text filled, or null for the translation's own words. */
  slot: string | null;
}

/**
 * Like `interpolate`, but keeps the filled values apart from the surrounding
 * words, so a screen can style a value (e.g. a bold country name) wherever the
 * language places it. Unknown slots stay as plain text.
 */
export function interpolateSegments(template: string, values: Record<string, string | number>): InterpolatedSegment[] {
  return template
    .split(/(%\{\w+\})/)
    .filter((part) => part !== '')
    .map((part) => {
      const name = /^%\{(\w+)\}$/.exec(part)?.[1];
      return name && Object.prototype.hasOwnProperty.call(values, name)
        ? { text: String(values[name]), slot: name }
        : { text: part, slot: null };
    });
}
