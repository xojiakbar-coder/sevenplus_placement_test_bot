# English Placement Telegram Bot (Telegraf)

English Placement test bot for **Grammar**, **Vocabulary**, and **Reading** (50 questions total).

## Requirements

- Node.js 18+ recommended
- A Telegram bot token from **@BotFather**

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create `.env` (copy from `.env.example`) and set your token:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
BOT_TOKEN=123456:ABCDEF_your_token_here
```

## Run

```bash
npm start
```

For auto-reload:

```bash
npm run dev
```

## Bot flow

- `/start` → asks for name
- requests phone number using **Share contact** button (works best on mobile Telegram)
- starts the 50-question test with inline buttons
- shows score and estimated level at the end

