const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { fetchRecommendations } = require("../utils/anilist");
const { buildAnimeOptions } = require("../utils/format");
const { awaitNumber } = require("../utils/prefix");
const store = require("../utils/store");

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
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("pick_anime").setPlaceholder("Add to watchlist...").addOptions(buildAnimeOptions(recs));

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(`Recommendations based on: ${base.title}`)
        .setDescription(`Found **${recs.length}** recommendations. Pick one to add!`)
        .setColor(0x9b59b6).setThumbnail(base.imageUrl)],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  },

  async prefixRun(message) {
    const userList = store.watchingMap[message.guildId]?.[message.author.id];
    if (!userList?.length) return message.reply("You're not watching anything yet! Use `tako watch <name>` first.");
    const base = userList[Math.floor(Math.random() * userList.length)];
    let recs;
    try { recs = await fetchRecommendations(base.id); } catch { return message.reply("Could not fetch recommendations."); }
    if (!recs?.length) return message.reply(`No recommendations for **${base.title}**.`);

    const listed = recs.slice(0, 10);
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`Recommendations based on: ${base.title}`)
        .setColor(0x9b59b6).setThumbnail(base.imageUrl)
        .setDescription(listed.map((a, i) => {
          const title = a.title.english || a.title.romaji;
          return `**${i + 1}.** [${title}](https://anilist.co/anime/${a.id})${a.averageScore ? ` ⭐ ${a.averageScore}%` : ""}`;
        }).join("\n"))
        .setFooter({ text: "Reply with a number to add to your watchlist" })],
    });

    const pick = await awaitNumber(message, "Which one?", listed.length);
    if (pick === null) return;
    const anime = listed[pick];
    const title = anime.title.english || anime.title.romaji;
    const guildId = message.guildId;
    const userList2 = store.watchingMap[guildId][message.author.id] || [];
    if (userList2.some((w) => w.id === anime.id)) return message.reply(`You're already watching **${title}**!`);
    userList2.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: message.author.username });
    store.watchingMap[guildId][message.author.id] = userList2;
    return message.reply(`Added **${title}** to your watchlist!`);
  },
};
