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
