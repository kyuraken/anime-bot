// Shared in-memory state across all commands
module.exports = {
  watchingMap: {},      // [guildId][userId] = [{ id, title, imageUrl, username, score? }]
  linkedAccounts: {},   // [guildId][userId] = { anilistUsername }
  activeReminders: new Set(), // "userId-animeId"
  animeCache: {},       // userId → anime array (for dropdown lookups)
  pageCache: {},        // userId → { page, type }
  pendingScore: {},     // userId → rating (for /score flow)

  ensureGuild(guildId) {
    if (!this.watchingMap[guildId]) this.watchingMap[guildId] = {};
    if (!this.linkedAccounts[guildId]) this.linkedAccounts[guildId] = {};
  },
};
