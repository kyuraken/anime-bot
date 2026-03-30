const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fetchSeasonalAnime } = require("../utils/anilist");
const { buildAnimeEmbed } = require("../utils/format");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder().setName("random").setDescription("Get a random anime from the current season"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let result;
    try { result = await fetchSeasonalAnime(1); } catch { return interaction.editReply("Could not fetch anime."); }
    const anime = result.media[Math.floor(Math.random() * result.media.length)];
    store.animeCache[interaction.user.id] = result.media;
    const embed = buildAnimeEmbed(anime).setAuthor({ name: "Random pick from this season!" });
    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`random_add:${anime.id}`).setLabel("Add to Watchlist").setStyle(ButtonStyle.Success)
      )],
    });
  },

  async handleButton(interaction) {
    await interaction.deferUpdate();
    const animeId = parseInt(interaction.customId.split(":")[1]);
    const cache = store.animeCache[interaction.user.id] || [];
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
    const embed = buildAnimeEmbed(anime).setAuthor({ name: "Random pick from this season!" });
    await message.reply({ embeds: [embed] });

    let collected;
    try {
      collected = await message.channel.awaitMessages({
        filter: (m) => m.author.id === message.author.id && m.content.trim() === "1",
        max: 1, time: 30000, errors: ["time"],
      });
    } catch { return; }

    const title = anime.title.english || anime.title.romaji;
    const userList = store.watchingMap[message.guildId][message.author.id] || [];
    if (userList.some((w) => w.id === anime.id)) return message.reply(`You're already watching **${title}**!`);
    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: message.author.username });
    store.watchingMap[message.guildId][message.author.id] = userList;
    return message.reply(`Added **${title}** to your watchlist!`);
  },
};
