// `candidate_status` is a free-form, backend-defined code (e.g.
// "registered", "documents_pending") -- unlike `current_workflow_stage`,
// which the backend already sends with a localized `name`, the
// CandidateProfile contract has no localized label for it (see
// openapi.yaml's CandidateProfile schema). There is no fixed, enumerable
// set of values the frontend could translate per-locale, so this renders a
// generic, locale-agnostic humanization rather than the raw
// underscored code (AGENTS.md: "Do not translate identifiers ... directly.
// Map them to localized presentation labels" -- flagged as a backend gap in
// the PR: a true localized label would need the backend to add one, the way
// it already does for workflow stages).
export function humanizeStatusCode(code: string): string {
  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
