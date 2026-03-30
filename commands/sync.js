const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { fetchAniListWatching } = require("../utils/anilist");
const store = require("../utils/store");

async function doSync(guildId, userId, username) {
  const animeList = await fetchAniListWatching(username);
  if (!animeList.length) return { added: [], total: 0 };

  const userList = store.watchingMap[guildId][userId] || [];
  const existingIds = new Set(userList.map((w) => w.id));
  const added = [];

  for (const anime of animeList) {
    if (!existingIds.has(anime.id)) {
      const title = anime.title.english || anime.title.romaji;
      userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium });
      added.push(title);
    }
  }
  store.watchingMap[guildId][userId] = userList;
  return { added, total: animeList.length };
}

module.exports = {
  data: new SlashCommandBuilder().setName("sync").setDescription("Sync your AniList watching list to the bot"),

  async execute(interaction) {
    const linked = store.linkedAccounts[interaction.guildId]?.[interaction.user.id];
    if (!linked) return interaction.reply({ content: "You haven't linked an AniList account yet. Use `/link <username>` first.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    let result;
    try { result = await doSync(interaction.guildId, interaction.user.id, linked.anilistUsername); } catch {
      return interaction.editReply("Could not fetch your AniList list. Try again later.");
    }
    if (!result.added.length) return interaction.editReply("Everything from your AniList is already in your watchlist!");
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(`Synced from AniList: ${linked.anilistUsername}`)
        .setColor(0x02a9ff)
        .setDescription(result.added.map((t) => `• ${t}`).join("\n"))
        .setFooter({ text: `${result.added.length} anime added` })],
    });
  },

  async prefixRun(message) {
    const linked = store.linkedAccounts[message.guildId]?.[message.author.id];
    if (!linked) return message.reply("You haven't linked an AniList account yet. Use `tako link <username>` first.");
    let result;
    try { result = await doSync(message.guildId, message.author.id, linked.anilistUsername); } catch {
      return message.reply("Could not fetch your AniList list. Try again later.");
    }
    if (!result.added.length) return message.reply("Everything from your AniList is already in your watchlist!");
    const { EmbedBuilder } = require("discord.js");
    return message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`Synced from AniList: ${linked.anilistUsername}`)
        .setColor(0x02a9ff)
        .setDescription(result.added.map((t) => `• ${t}`).join("\n"))
        .setFooter({ text: `${result.added.length} anime added` })],
    });
  },
};
