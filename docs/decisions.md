# SLOT decisions — 2026-10-30

Walter approved Gmail as both sender and recipient; no purchased domain. The self-email ICS pilot imported correctly on his iPhone with the correct Berlin time (confirmed in this chat). This validates that particular pilot and device, not every mail client.

Public site: independent GitHub repository and GitHub Pages linked from the personal Hub. Worker + D1 backend in Western Europe. Walter activated Cloudflare Zero Trust Free himself after reviewing its billing screen. He chose Access over Google login for the private desk. Access permits his exact email; the Worker additionally verifies the signed JWT, issuer, audience, expiry and owner. TTL default 30 minutes, option 15. A consumed code never becomes usable again after an email failure.

Email delivery is automatic after a valid submission. Manual calendar import remains Walter's decision. No Calendar API, availability checks, automatic invitations or guest email.

## Current design — gallery-first redesign

The first ticket/orbit design was rejected by Walter as too familiar. The redesigned page has only SLOT, a date calendar, time selection, Name, Topic, Code and Send. No hero, slogan or promotional subtitle. The old local study/HTML5 UP direction is superseded.

Observed 2026-10-30: started at https://curated.design/inspiration/productivity/ and https://curated.design/inspiration/neobrutalism/, then opened WeekSync, IsoMeet, Berd and Utopia Tokyo. Selected https://www.utopiatokyo.com/ for its vivid red field, black typographic hierarchy and ruled graphic composition, adapted into a functional coral scheduling board. Its art direction is credited to SPOTHEROZ (https://spotheroz.ch/) and development to Andrew Measham on the source site. WeekSync (https://weeksync.app/) informed calendar interaction research. IsoMeet's hero and Berd's 3D workspace were observed but not adopted. Curated is credited as the discovery source.

This is inspiration-only adaptation: original HTML/CSS/JS, SVG icon and system fonts; no source code, artwork, logos, proprietary fonts or template assets were copied. Credits are in an accessible dialog rather than permanent promotional copy. Native animation preserves missing-code collapse and a confirmed-send checkmark; reduced motion preserves outcomes. The private generator uses the same graphic language and functional labels. Calendar navigation supports keyboard arrows and year boundaries; past/out-of-range dates are disabled. Backend authorization, storage, rate limits and mail semantics are unchanged.

Operational caveat: one logical mail per code, not exactly-once physical delivery. Gmail API has no provider-level idempotency key. Ambiguous post-send failures must stop for owner review instead of blindly retrying. Connection failures before sending can retry safely. Credentials and tokens remain server-side.

Google consent is in production for this personal use, with basic identity and gmail.send. The owner completed authorization through the authenticated desk. This is an unverified personal app; it is not advertised as Google-verified. The refresh credential is encrypted in D1. Reconnection can resume only jobs proven not to have reached the Gmail sending stage.

Live end-to-end check: a 15-minute pass generated in the desk was submitted from the deployed GitHub Pages site. Gmail accepted one message; it appeared in the owner's Inbox and Sent with a text/calendar attachment. The received ICS contains one event, 2026-10-31 12:30–13:00 Europe/Berlin (11:30–12:00 UTC). A fresh submission with that consumed pass was rejected. The earlier iPhone import pilot passed; the new live attachment's iPhone import has not been independently confirmed.

Verification: 36 automated tests passed, including 50 competing mocked submissions, signed identity validation, OAuth state/cookie/single-use and owner restrictions, immutable retry, DST/ICS injection, safe reconnection, private response caching and rate limiting without spending a valid pass. A separate local workerd/D1 runtime check confirmed one request and one outbox item from 50 competing consumers. Live copy-to-clipboard, used-pass rejection, revoked-pass rejection and missing-code transition passed. Administrative responses explicitly prohibit caching and preview deployment URLs are disabled. Screenshots in evidence contain only synthetic UI data, never active passes or OAuth material.

Walter requested a clearly structured email. A second deployed end-to-end test arrived with Name, Topic, Date and time, a separate SLOT footer and the ICS. Its received ICS preserved the submitted name and full multiline note and encoded 2026-10-31 14:00–14:30 Berlin correctly.

Cloudflare's assets-upload-session API failed twice with HTTP 500/10013 during the final update; a later controlled attempt succeeded without changing the active hosting mode. Atlas reviewed the contingency and the security boundaries. A generated bundled-asset fallback is available for future provider incidents, but production continues to use Static Assets. The health endpoint reports a deterministic source build identifier. Published build at delivery: 037090573ef0d4b7b4c9; Cloudflare version 8270c1a2-c7a1-445b-a525-d895cfc76219.

Redesign verification: 38 tests pass, including calendar leap-day/six-week layout and year navigation, plus the existing security/concurrency/OAuth/ICS suite. Public responsive interaction and deployment checks are recorded separately after publication.

Redesign backend published build: dd2f961fb55ae95f7245, Worker version 505ba5e8-5052-44fa-a031-d690298be8ec, normal Static Assets deployment. No schema, OAuth, Access, secret, permission or billing changes. The associated frontend-patterns correction is in the private toolkit 0.13.8, PR #18, and installed once in user scope; historical project snapshots are preserved.
