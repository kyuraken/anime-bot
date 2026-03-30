const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fetchSeasonalAnime, getCurrentSeason } = require("../utils/anilist");
const { buildSeasonalListEmbed } = require("../utils/format");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("seasonal")
    .setDescription("Browse this season's anime"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let result;
    try { result = await fetchSeasonalAnime(1); } catch { return interaction.editReply("Could not fetch seasonal anime."); }
    const { media, pageInfo } = result;
    const { season, year } = getCurrentSeason();
    store.pageCache[interaction.user.id] = { page: 1, type: "seasonal" };
    await interaction.editReply({
      embeds: [buildSeasonalListEmbed(media, pageInfo, season, year)],
      components: [buildPageButtons(pageInfo, 1)],
    });
  },

  async handleButton(interaction) {
    await interaction.deferUpdate();
    const pageData = store.pageCache[interaction.user.id];
    if (!pageData || pageData.type !== "seasonal") return;
    const newPage = interaction.customId === "seasonal_next" ? pageData.page + 1 : pageData.page - 1;
    if (newPage < 1) return;
    let result;
    try { result = await fetchSeasonalAnime(newPage); } catch { return; }
    const { media, pageInfo } = result;
    if (!media.length) return;
    const { season, year } = getCurrentSeason();
    store.pageCache[interaction.user.id] = { page: newPage, type: "seasonal" };
    await interaction.editReply({
      embeds: [buildSeasonalListEmbed(media, pageInfo, season, year)],
      components: [buildPageButtons(pageInfo, newPage)],
    });
  },

  async prefixRun(message) {
    let result;
    try { result = await fetchSeasonalAnime(1); } catch { return message.reply("Could not fetch seasonal anime."); }
    const { media, pageInfo } = result;
    const { season, year } = getCurrentSeason();
    return message.reply({ embeds: [buildSeasonalListEmbed(media, pageInfo, season, year)] });
  },
};

function buildPageButtons(pageInfo, currentPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("seasonal_prev").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId("seasonal_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(!pageInfo.hasNextPage),
  );
}
