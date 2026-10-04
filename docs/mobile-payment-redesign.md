# Mobile Payment redesign

Mobile payment uses the same compact blue gradient header, pale blue background, rounded cards, and colorful icons as Documents, Status, and Profile. The header includes a back control and page title without the Descon logo. Main actions are 34 points high, with English and Urdu text and physical RTL rows. Amounts remain backend decimal strings; no money calculations or rounding are introduced.

The fee summary and latest payment card show authoritative backend amounts and status. Paid receipts preserve the paid date and safe payment reference; pending, failed, cancelled, unknown, and expired states stay distinct. Waiting and unavailable notices remain readable and offer the existing manual refresh after polling times out.

Existing GET/POST candidate payment contracts, eligibility gates, idempotency, polling, retries, logout handling, and hosted checkout origin restrictions are unchanged. A checkout redirect or close never marks a payment as paid. The provider checkout itself is not restyled.

Verification: mobile typecheck and complete Jest suite; web typecheck, tests and build; git diff check. Native screenshots at small/large widths and Urdu font scaling still need device QA because this workspace has no running native emulator.
