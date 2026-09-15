# British world app family

The Atlas app directory at `/network` is the common entry point. Its shared strip is mounted once in the root layout, with a reciprocal directory link in the local Mannin app. Each application retains its existing design, voice, content and local controls.

`app/network/routing.ts` is the app registry: stable identity, role, editorial voice, scope, entry route and owning data API. `app/network/data.ts` assembles a compact place index from the existing place, territory and answer libraries. `/api/network` exposes this navigation contract to other tools. It is not a merged or newly verified corpus.

The directory carries a supported `place` slug. The router translates it to the existing visual `place` filter, the answer library's canonical `jurisdiction` value, or the territory's dossier, insolvency and context paths. A library without that coverage shows its actual wider scope. Manx tools always disclose Isle of Man scope. A name alias must resolve against the answer library before it is used in a link.

The common research sequence is: identify the place → orient in its dossier or map → read the relevant specialist library → follow original sources → ask for further investigation where appropriate. Preserve source ownership, review date, jurisdiction, qualifications and uncertainty. A link does not upgrade an outline or older claim to verified evidence.

Mannin retains the existing local runtime and conversation. Its library links open a new tab; the hosted directory opens the existing loopback address only on a user click. No chat history, microphone state or draft is copied by this navigation layer. Sharing a directory URL shares only the selected place.

To add another application, give it a registry entry and a real destination, specify its persona and actual scope, and verify its routes. To add another place, reconcile it with the existing source libraries. Do not invent matching coverage when a specialist library does not support it.

Verification: `tests/network.test.mjs` checks all territory mappings, the exact destination scopes, unknown-context handling and both sides of the navigation. The existing rendered-site suite checks the sitemap and permanent routes.
