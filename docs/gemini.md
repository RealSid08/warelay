# Building Your Own AI Personal Assistant with warelay (Gemini Edition)

> **TL;DR:** warelay lets you turn Google Gemini into a proactive personal assistant that lives in your pocket via WhatsApp. It can check in on you, remember context across conversations, run commands on your Mac, and even wake you up with music. This doc shows you how.

---

## ⚠️ Warning: Here Be Dragons

**This setup gives an AI full access to your computer.** Before you proceed, understand what you're signing up for:

- 🔓 **Autonomous Mode** means Gemini can run *any* shell command without asking (if configured with `--yolo` or similar flags)
- 🤖 **AI makes mistakes** - it might delete files, send emails, or do things you didn't intend
- 🔥 **Heartbeats run autonomously** - your AI acts even when you're not watching
- 📱 **WhatsApp is not encrypted E2E here** - messages pass through your Mac in plaintext

**The good news:** You can use the official Gemini CLI (`@google/gemini-cli`) with your Google account or API key.

**Start conservative:**
1. Monitor the logs initially.
2. Set `heartbeatMinutes: 0` to disable proactive pings initially.
3. Use a test phone number in `allowFrom` first.

This is experimental software running experimental AI. **You are responsible for what your AI does.**

---

## Prerequisites: The Two-Phone Setup

**Important:** You need a **separate phone number** for your AI assistant. Here's why and how:

### Why a Dedicated Number?

warelay uses WhatsApp Web to receive messages. If you link your personal WhatsApp, *you* become the assistant - every message to you goes to Gemini. Instead, give your assistant its own identity:

- 📱 **Get a second SIM** - cheap prepaid SIM, eSIM, or old phone with a number
- 💬 **Install WhatsApp** on that phone and verify the number
- 🔗 **Link to warelay** - run `warelay login` and scan the QR with that phone's WhatsApp
- ✉️ **Message your AI** - now you (and others) can text that number to reach your assistant

### The Setup

```
Your Phone (personal)          Second Phone (AI)
┌─────────────────┐           ┌─────────────────┐
│  Your WhatsApp  │  ──────▶  │  AI's WhatsApp  │
│  +1-555-YOU     │  message  │  +1-555-GEMINI  │
└─────────────────┘           └────────┬────────┘
                                       │ linked via QR
                                       ▼
                              ┌─────────────────┐
                              │  Your Mac       │
                              │  (warelay)      │
                              │  Gemini CLI     │
                              └─────────────────┘
```

The second phone just needs to stay on and connected to the internet occasionally (WhatsApp Web stays linked for ~14 days without the phone being online).

---

## Meet Your Gemini Assistant 👋

Your Gemini assistant is built on warelay. Here's what makes it special:

- **Always available** via WhatsApp - no app switching, works on any device
- **Proactive heartbeats** - It checks in every 10 minutes and can alert you to things (low battery, calendar reminders, anything it notices)
- **Persistent memory** - Gemini CLI automatically saves session history, allowing conversations to span days/weeks
- **Full Mac access** - can run commands, take screenshots, control Spotify, read/write files
- **Multimodal** - Send images and audio directly to Gemini for analysis

The magic is in the combination: WhatsApp's ubiquity + Gemini's multimodal intelligence + warelay's plumbing + your Mac's capabilities.

## Prerequisites

- Node 22+, `warelay` installed: `npm install -g warelay`
- Gemini CLI installed and authenticated:
  ```sh
  npm install -g @google/gemini-cli
  gemini
  # Follow the browser login flow or set GEMINI_API_KEY
  ```

## The Config That Powers Your Assistant

This is a recommended config for running a Gemini-powered assistant (`~/.warelay/warelay.json`):

```json5
{
  logging: { level: "trace", file: "/tmp/warelay/warelay.log" },
  inbound: {
    allowFrom: ["+1234567890"],  // your phone number
    reply: {
      mode: "command",
      cwd: "/Users/sidhaarthkrishnan/gemini",   // Give your AI a workspace!
      bodyPrefix: "You are Gem, a helpful assistant on WhatsApp.",
      command: [
        "gemini",
        "--output-format", "json", // Ensure structured output for warelay
        "{{BodyStripped}}"
      ],
      geminiOutputFormat: "json", // Tell warelay to parse JSON output
      session: {
        scope: "per-sender",
        resetTriggers: ["/new"],
        idleMinutes: 10080,       // 7 days of context!
        heartbeatIdleMinutes: 10080,
        // Gemini CLI does not support named sessions via flags.
        // We use "latest" to resume the last conversation.
        // WARNING: This effectively makes the assistant single-user (shared context).
        sessionArgNew: [], 
        sessionArgResume: ["--resume", "latest"],
        sessionArgBeforeBody: true,
        sendSystemOnce: true      // intro only on first message
      },
      timeoutSeconds: 900         // 15 min timeout for complex tasks
    }
  }
}
```

### Key Design Decisions

| Setting | Why |
|---------|-----|
| `cwd: ~/gemini_assistant` | Give your AI a home! It can store memories, notes, images here |
| `idleMinutes: 10080` | 7 days of context - your AI remembers conversations |
| `geminiOutputFormat: "json"` | Ensures reliable parsing of responses and metadata |

## Heartbeats: Your Proactive Assistant

This is where warelay gets interesting. Every 10 minutes (configurable), warelay pings Gemini with:

```
HEARTBEAT
```

Gemini is instructed to reply with exactly `HEARTBEAT_OK` if nothing needs attention. That response is **suppressed** - you don't see it. But if Gemini notices something worth mentioning, it sends a real message.

### What Can Heartbeats Do?

Your assistant uses heartbeats to do **real work**, not just check in:

1. **Give it a home** - A dedicated folder lets your AI build persistent memory
2. **Long sessions** - Rich context across conversations
3. **Let it surprise you** - Configure heartbeats to occasionally share something fun or interesting

The key insight: heartbeats let your AI be **proactive**, not just reactive. Configure what matters to you!

### Heartbeat Config

```json5
{
  inbound: {
    reply: {
      heartbeatMinutes: 10,  // how often to ping (default 10 for command mode)
      // ... rest of config
    }
  }
}
```

Set to `0` to disable heartbeats entirely.

### Manual Heartbeat

Test it anytime:
```sh
warelay heartbeat --provider web --to +1234567890 --verbose
```

## How Messages Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  WhatsApp   │────▶│   warelay   │────▶│   Gemini    │────▶│  Your Mac   │
│  (phone)    │◀────│   relay     │◀────│   CLI       │◀────│  (commands) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Inbound**: WhatsApp message arrives via Baileys (WhatsApp Web protocol)
2. **Queue**: warelay queues it (one Gemini run at a time)
3. **Typing**: "composing" indicator shows while Gemini thinks
4. **Execute**: Gemini runs with full shell access in your `cwd`
5. **Parse**: warelay extracts text + any `MEDIA:` paths from output
6. **Reply**: Response sent back to WhatsApp

## Media: Images, Voice, Documents

### Receiving Media
Inbound images/audio/video are downloaded and available as `{{MediaPath}}`. Gemini is multimodal and can understand these directly!

Ensure your command includes the media path if the CLI requires it explicitly, or rely on the system prompt to guide the model to look for it.

### Sending Media
Include `MEDIA:/path/to/file.png` in Gemini's output to attach images. warelay handles resizing and format conversion automatically.

## Starting the Relay

```sh
# Foreground (see all logs)
warelay relay --provider web --verbose

# Background in tmux (recommended)
warelay relay:tmux

# With immediate heartbeat on startup
warelay relay:heartbeat:tmux
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No reply | Check `gemini` is in PATH and authenticated |
| Timeout | Increase `timeoutSeconds` or simplify the task |
| JSON Errors | Ensure `geminiOutputFormat` matches CLI output |
| Heartbeat spam | Tune `heartbeatMinutes` or set to 0 |

## Minimal Config (Just Chat)

Don't need the fancy stuff? Here's the simplest setup:

```json5
{
  inbound: {
    reply: {
      mode: "command",
      command: ["gemini", "{{Body}}"]
    }
  }
}
```

Still gets you: message queue, typing indicators, auto-reconnect. Just no sessions or heartbeats.
