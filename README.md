# 🎌 Anime Season Bot — Setup Guide

A Discord bot that lets server members browse the current anime season and display what they're watching.

---

## 📋 Commands

| Command | What it does |
|---|---|
| `/seasonal` | Shows a dropdown of this season's top 25 anime. Pick one to announce you're watching it. |
| `/watching` | Shows the full list of who's watching what on the server. |
| `/clear` | Removes your watching status. |

---

## 🛠️ Setup (Step by Step)

### Step 1 — Install Node.js
You need Node.js version 18 or higher.
Download it from: https://nodejs.org (click the "LTS" version)

Check it installed correctly by opening a terminal and typing:
```
node --version
```
You should see something like `v20.0.0`.

---

### Step 2 — Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** → give it a name like "Anime Season Bot"
3. Click **"Bot"** in the left sidebar
4. Click **"Reset Token"** → copy that token (keep it secret! treat it like a password)
5. Scroll down and enable these **Privileged Gateway Intents**:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Click **"Save Changes"**

---

### Step 3 — Invite the Bot to Your Server

1. In your application, click **"OAuth2"** → **"URL Generator"**
2. Under **Scopes**, check: `bot` and `applications.commands`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Embed Links`
   - `Use Slash Commands`
4. Copy the generated URL at the bottom and open it in your browser
5. Select your server and click **Authorize**

---

### Step 4 — Set Up the Bot Files

1. Download or copy the bot files into a folder called `anime-bot`
2. Open a terminal inside that folder
3. Install dependencies:
```
npm install
```
4. Create a file called `.env` in the same folder with this content:
```
DISCORD_TOKEN=paste_your_token_here
```
Replace `paste_your_token_here` with the token you copied in Step 2.

⚠️ **Never share your .env file or commit it to GitHub!**

---

### Step 5 — Run the Bot

```
npm start
```

You should see:
```
✅ Logged in as YourBotName#1234
✅ Slash commands registered globally
```

> **Note:** Slash commands can take up to 1 hour to appear in Discord after first registration. For instant registration during development, you can register them to a specific guild (server) instead — ask if you want that version.

---

## 📁 File Structure

```
anime-bot/
├── index.js        ← The bot code (all the logic lives here)
├── package.json    ← Tells Node what packages we need
├── .env            ← Your secret bot token (don't share this!)
└── README.md       ← This file
```

---

## 🔁 How It Works (Simple Explanation)

1. User types `/seasonal` in Discord
2. Bot asks AniList's free API: *"What anime is airing this season?"*
3. AniList sends back a list of up to 25 anime
4. Bot shows a dropdown menu (only visible to the user who asked)
5. User picks one → bot posts a public message: "**@User is now watching Anime Title!**"
6. Anyone can type `/watching` to see the full server list

Data is stored **in memory** while the bot runs. If you restart the bot, the watching list resets. For permanent storage, you'd add a database like SQLite.

---

## 🆘 Common Problems

**"Cannot find module 'discord.js'"**
→ Run `npm install` in the bot folder

**Slash commands not showing up**
→ Wait up to 1 hour, or re-invite the bot with the correct permissions

**Bot goes offline when I close my terminal**
→ To keep it running 24/7, use a free service like [Railway](https://railway.app) or [Render](https://render.com), or run it on a Raspberry Pi
