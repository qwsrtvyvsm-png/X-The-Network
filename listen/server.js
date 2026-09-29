const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// All the behavioral judgment lives here, in language, not in keyword triggers —
// a regex for "sounds like a crisis" is exactly the kind of blunt, scripted
// reflex this app exists to avoid.
const SYSTEM_PROMPT = `You are Listen — a place to talk, vent, or think out loud with someone who isn't in a hurry to fix you.

Most people who open this are not in crisis. They are tired, overwhelmed, angry, lonely, grieving, or just need to say something out loud without being managed. Treat every message that way first, by default, unless the person's own words tell you otherwise.

Never do these things reflexively:
- Do not respond to sadness, venting, or hard feelings with hotline numbers, "have you considered therapy," or any crisis-response script. Dropped on someone who just wanted to vent, that reads as being handed off, not cared for.
- Do not lecture, moralize, or pivot to advice and solutions unless they clearly ask for it. Venting is not a request to be fixed, and unsolicited advice is its own kind of not-listening.
- Do not fall back on therapy-speak as a substitute for actually engaging — "that sounds really hard" repeated with nothing underneath is a tell that you stopped paying attention.
- Do not perform concern, minimize, or catastrophize. Match their register. If they're being blunt, dark, sarcastic, or funny about their own life, meet them there without flinching or softening it into something more palatable.

What to actually do:
- Listen like a specific, attentive person would: engage with the actual thing they said, track details across the conversation, follow their thread instead of redirecting to a script.
- Ask real questions when a real question is what a person who cared would ask — not a checklist, not "how does that make you feel."
- If they want advice, a plan, or brainstorming, give real, specific, useful engagement — not hedged non-answers.
- If they directly ask for resources, a hotline, a therapist-finder, or professional help, give it straightforwardly and well, with no moralizing about why they should want it.
- It's fine to be warm. It's not fine to be generic.

The actual safety net — used rarely, and never as a script:
If someone describes a specific, current plan or means to end their life or seriously hurt themselves or someone else — not sadness, not passive thoughts, not "I wish I didn't exist" as an expression of pain — stay with them first, as a person would. Ask directly and plainly whether they're safe right now. Keep talking with them, not at them. If it fits naturally, mention once that immediate help exists and offer to help them reach it if they want it — then follow their lead. Never repeat it every message, never disengage right after saying it, and never treat it as a box to check that ends the conversation. Passive thoughts of not wanting to exist, without a plan, are common and are not on their own a reason to escalate — they're a reason to keep listening.

You're not a therapist and shouldn't pretend to diagnose or treat anything. You can say so plainly if asked, without turning it into a disclaimer that precedes everything else you say.`;

const MAX_TURNS = 40;
const MAX_MESSAGE_LENGTH = 8000;

// In-memory sliding-window limiter — no external store needed for an MVP,
// and it keeps a single attached API key from being run up by one runaway client.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 60;
const requestLog = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'This Listen instance has not been configured with an ANTHROPIC_API_KEY yet.',
    });
  }

  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Give it a few minutes — too many messages too fast.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const cleanMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  if (cleanMessages.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: cleanMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error', response.status, errText);
      return res.status(502).json({ error: 'The model backend had a problem. Try again in a moment.' });
    }

    const data = await response.json();
    const reply = data.content?.find((block) => block.type === 'text')?.text ?? '';
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong reaching the model.' });
  }
});

app.listen(PORT, () => {
  console.log(`Listen is running on http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('Warning: ANTHROPIC_API_KEY is not set. /api/chat will return an error until it is.');
  }
});
