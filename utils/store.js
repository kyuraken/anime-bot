// Shared state across all commands — persisted to disk
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data.json");

const store = {
  watchingMap: {},      // [guildId][userId] = [{ id, title, imageUrl, username, score? }]
  linkedAccounts: {},   // [guildId][userId] = { anilistUsername }
  activeReminders: new Set(), // "userId-animeId"
  animeCache: {},       // userId → anime array (for dropdown lookups)
  pageCache: {},        // userId → { page, type }
  pendingScore: {},     // userId → rating (for /score flow)
  activeGames: new Set(), // channelId — prevents multiple games in same channel
  guessScores: {},     // [guildId][userId] = { wins, username }
  starboard: {},       // [guildId] = [{ messageId, content, authorTag, authorAvatar, channelId, imageUrl?, stars, timestamp }]

  ensureGuild(guildId) {
    if (!this.watchingMap[guildId]) this.watchingMap[guildId] = {};
    if (!this.linkedAccounts[guildId]) this.linkedAccounts[guildId] = {};
    if (!this.starboard[guildId]) this.starboard[guildId] = [];
  },

  // ── Persistence ─────────────────────────────────────────────
  save() {
    try {
      const data = {
        watchingMap: this.watchingMap,
        linkedAccounts: this.linkedAccounts,
        guessScores: this.guessScores,
        starboard: this.starboard,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save data:", err);
    }
  },

  load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data.watchingMap) this.watchingMap = data.watchingMap;
      if (data.linkedAccounts) this.linkedAccounts = data.linkedAccounts;
      if (data.guessScores) this.guessScores = data.guessScores;
      if (data.starboard) this.starboard = data.starboard;
      console.log("Loaded saved data from data.json");
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  },
};

// Load on startup
store.load();

module.exports = store;
