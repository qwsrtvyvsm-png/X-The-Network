# Listen

A place to talk, vent, or think out loud with something that isn't in a hurry to fix you.

## Why this exists

Most mainstream AI chat products handle emotionally heavy conversation with a
blunt, keyword-triggered reflex: say something sad, get a hotline number and a
suggestion to see a professional, whether or not that's what you asked for.
It's a defensible reflex from a liability standpoint, and it's also the reason
a lot of people find these tools unbearable to actually confide in — the
moment things get real, you stop being talked *with* and start being
processed.

The root cause isn't "the model needs a safety feature." It's that safety and
warmth get implemented as two separate systems bolted together — a scripted
crisis layer sitting in front of an otherwise generic assistant. Listen's
architecture is a deliberate bet against that pattern: there is exactly one
behavioral system — the prompt in `server.js` — and it carries both the
instruction to actually listen and the instruction for when to step in for
real safety reasons. There's no separate keyword filter deciding when to
override the persona with a script, because that filter is what produces the
dismissiveness this app exists to avoid. The model is trusted to use judgment,
the same way a person would.

## What it is / isn't

- It's a peer-support conversational companion: for venting, thinking out
  loud, or just talking, without being redirected to advice, resources, or
  professional help unless you ask for that.
- It is **not** a therapist, a diagnostic tool, or a crisis service. It says
  so plainly if you ask, without leading with a disclaimer.
- It does keep a real safety net for the rare case someone discloses an
  active, specific plan to hurt themselves or someone else — see the system
  prompt in `server.js` for exactly how that's handled (stay with the person,
  ask directly if they're safe, offer help once, keep talking — never a
  scripted hand-off).

## Running it

```bash
cd listen
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
npm start
```

Open `http://localhost:3000`.

## Notes on the current MVP

- Conversation history is kept client-side only (`localStorage`), not stored
  server-side — there's no database in this prototype. Clearing browser data
  clears the conversation.
- `/api/chat` has a simple in-memory per-IP rate limit so one client can't run
  up the attached API key; it resets if the server restarts and isn't meant
  to survive a multi-instance deployment as-is.
- No auth, no persistence layer, no streaming yet — all reasonable next steps
  once this is validated as a product direction rather than a prototype.
