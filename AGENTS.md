# SLOT

Private, one-use invitations to email Walter an appointment proposal with an ICS attachment. English public UI, concise and playful. No automatic calendar writes, approval flow, guest accounts or guest email collection.

Keep all authorization and input validation on the server. Codes have 128 bits of cryptographic randomness, are stored only as SHA-256 hashes, expire after 15 or 30 minutes and permit a single immutable proposal. Persistence and code consumption must be atomic. Gmail recipient is server configuration, never visitor input.

Never commit credentials, real emails, visitor data, generated invitations or OAuth callbacks. Gmail permission is send-only. Administrative routes fail closed. Public preview must never pretend an email was sent. Verify concurrency, retries, expiry, revocation, credential isolation, ICS injection and malicious input before deploying.

Walter rejected the ticket/orbit design. Public UI must show SLOT and the appointment interface, without a hero, slogans or decorative subtitles. Start new visual directions in the linked live design galleries, inspect concrete references and credit them appropriately. Preserve success feedback and finite black-hole disappearance without a code, with reduced-motion support. Never infer availability or claim a booking is confirmed.
