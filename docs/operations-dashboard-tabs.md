# Operations dashboard tabs

Overview now prioritizes four colored metrics, the oldest eight delayed candidate rows, a six-stage pipeline snapshot and the latest mobilization. Critical cases are included in the delayed total and must not be added to it. Candidate rows show the backend stage age, priority, reference and links to the candidate workspace.

Pipeline contains a bounded stage chart, readable English/Urdu stage labels, clickable counts, expandable zero-count stages and conversion metrics. Stage links carry country/project/craft filters to the candidate directory.

Mobilization owns craft performance, country/project distribution, trend granularity and latest mobilization. Filters stay common across tabs. Tabs support arrows, Home/End, focus and Urdu direction. Icons/emojis are decorative; text remains the accessible source of meaning.

Deploy the companion backend patch for attention_candidates before this frontend. An older backend retains summary counts and explicitly reports unavailable follow-up rows; it does not show fabricated rows or a false empty state.

All 204 web test files / 2051 tests passed; web typecheck, production build and diff checks passed. Live visual QA is unavailable in this workspace: no browser executable is installed and the attempted browser download failed. Ruby/Bundler checks for the companion API must run in the backend environment.
