// Shared in-memory state across all commands
module.exports = {
  watchingMap: {},      // [guildId][userId] = [{ id, title, imageUrl, username, score? }]
  linkedAccounts: {},   // [guildId][userId] = { anilistUsername }
  activeReminders: new Set(), // "userId-animeId"
  animeCache: {},       // userId → anime array (for dropdown lookups)
  pageCache: {},        // userId → { page, type }
  pendingScore: {},     // userId → rating (for /score flow)
  activeGames: new Set(), // channelId — prevents multiple games in same channel
  guessScores: {},     // [guildId][userId] = { wins, streak }

  ensureGuild(guildId) {
    if (!this.watchingMap[guildId]) this.watchingMap[guildId] = {};
    if (!this.linkedAccounts[guildId]) this.linkedAccounts[guildId] = {};
  },
};
