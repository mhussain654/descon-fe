import { Sparkles } from 'lucide-react';
import { Link } from 'react-router';

/**
 * A single real, computed sentence about a dashboard's current state --
 * never AI-generated prose. Purely presentational: each dashboard builds
 * its own already-translated `text` (and optional `linkPath`) from numbers
 * its own response already contains, so the banner can never say something
 * the panels below it don't already back up. Shared shell so Admin/MPS/...
 * don't each re-implement the same layout.
 */
export function InsightBanner({
  title,
  text,
  linkPath,
  linkLabel,
}: {
  title: string;
  text: string;
  linkPath?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <div>
          {/* text-brand-emphasis/text-brand, not text-text-primary/-secondary:
              bg-brand-subtle is a fixed light tint (shared/design-tokens.ts's
              brand/success/warning/etc. subtle-emphasis pairs are literal hex,
              unlike text/surface which have dark-theme CSS-variable overrides
              -- see StatTile's identical bg-brand-subtle text-brand pairing),
              so text here must stay fixed-dark too or it goes near-white and
              unreadable once the page is in dark mode. */}
          <div className="text-sm font-semibold text-brand-emphasis">{title}</div>
          <p className="text-sm text-brand">{text}</p>
        </div>
      </div>
      {linkPath && linkLabel ? (
        <Link to={linkPath} className="shrink-0 text-sm font-medium text-brand hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
