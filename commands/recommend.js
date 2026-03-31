const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { fetchRecommendations } = require("../utils/anilist");
const { buildAnimeOptions } = require("../utils/format");
const store = require("../utils/store");

function buildRecsEmbed(base, recs) {
  return new EmbedBuilder()
    .setTitle(`Recommendations based on: ${base.title}`)
    .setDescription(`Found **${recs.length}** recommendations. Pick one to add!`)
    .setColor(0x9b59b6).setThumbnail(base.imageUrl);
}

function buildRecsDropdown(recs) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("pick_anime").setPlaceholder("Add to watchlist...").addOptions(buildAnimeOptions(recs))
  );
}

module.exports = {
  data: new SlashCommandBuilder().setName("recommend").setDescription("Get anime recommendations based on your watchlist"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.editReply("You're not watching anything yet! Use `/watch` first.");
    const base = userList[Math.floor(Math.random() * userList.length)];
    let recs;
    try { recs = await fetchRecommendations(base.id); } catch { return interaction.editReply("Could not fetch recommendations."); }
    if (!recs?.length) return interaction.editReply(`No recommendations found for **${base.title}**.`);

    store.animeCache[interaction.user.id] = recs;
    await interaction.editReply({ embeds: [buildRecsEmbed(base, recs)], components: [buildRecsDropdown(recs)] });
  },

  async prefixRun(message) {
    const userList = store.watchingMap[message.guildId]?.[message.author.id];
    if (!userList?.length) return message.reply("You're not watching anything yet! Use `tako watch <name>` first.");
    const base = userList[Math.floor(Math.random() * userList.length)];
    let recs;
    try { recs = await fetchRecommendations(base.id); } catch { return message.reply("Could not fetch recommendations."); }
    if (!recs?.length) return message.reply(`No recommendations for **${base.title}**.`);

    store.animeCache[message.author.id] = recs;
    await message.reply({ embeds: [buildRecsEmbed(base, recs)], components: [buildRecsDropdown(recs)] });
  },
};
