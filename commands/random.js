const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fetchSeasonalAnime } = require("../utils/anilist");
const { buildAnimeEmbed } = require("../utils/format");
const store = require("../utils/store");

function buildAddButton(animeId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`random_add:${animeId}`).setLabel("Add to Watchlist").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("random_reroll").setLabel("🎲 Reroll").setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder().setName("random").setDescription("Get a random anime from the current season"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let result;
    try { result = await fetchSeasonalAnime(1); } catch { return interaction.editReply("Could not fetch anime."); }
    const anime = result.media[Math.floor(Math.random() * result.media.length)];
    store.animeCache[interaction.user.id] = result.media;
    const embed = buildAnimeEmbed(anime).setAuthor({ name: "Random pick from this season!" });
    await interaction.editReply({ embeds: [embed], components: [buildAddButton(anime.id)] });
  },

  async handleButton(interaction) {
    await interaction.deferUpdate();
    const cache = store.animeCache[interaction.user.id] || [];

    // Reroll — pick a new random anime
    if (interaction.customId === "random_reroll") {
      if (!cache.length) return;
      const anime = cache[Math.floor(Math.random() * cache.length)];
      const embed = buildAnimeEmbed(anime).setAuthor({ name: "Random pick from this season!" });
      return interaction.editReply({ embeds: [embed], components: [buildAddButton(anime.id)] });
    }

    // Add to watchlist
    const animeId = parseInt(interaction.customId.split(":")[1]);
    const anime = cache.find((a) => a.id === animeId);
    if (!anime) return interaction.editReply({ content: "Could not find that anime. Try `/random` again.", components: [] });

    const title = anime.title.english || anime.title.romaji;
    const guildId = interaction.guildId;
    const userList = store.watchingMap[guildId][interaction.user.id] || [];
    if (userList.some((w) => w.id === anime.id)) return interaction.editReply({ content: `You're already watching **${title}**!`, components: [] });
    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: interaction.user.username });
    store.watchingMap[guildId][interaction.user.id] = userList;
    await interaction.editReply({ content: `Added **${title}** to your watchlist!`, components: [] });
  },

  async prefixRun(message) {
    let result;
    try { result = await fetchSeasonalAnime(1); } catch { return message.reply("Could not fetch anime."); }
    const anime = result.media[Math.floor(Math.random() * result.media.length)];
    store.animeCache[message.author.id] = result.media;
    const embed = buildAnimeEmbed(anime).setAuthor({ name: "Random pick from this season!" });
    await message.reply({ embeds: [embed], components: [buildAddButton(anime.id)] });
  },
};
