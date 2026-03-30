const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { fetchSeasonalByGenre, getCurrentSeason } = require("../utils/anilist");
const { buildAnimeOptions, formatTimeUntilAiring } = require("../utils/format");
const { awaitNumber } = require("../utils/prefix");
const store = require("../utils/store");

function buildGenreEmbed(animeList, genre, season, year) {
  const text = animeList.slice(0, 10).map((anime, i) => {
    const title = anime.title.english || anime.title.romaji;
    const score = anime.averageScore ? `⭐ ${anime.averageScore}%` : "";
    const nextEp = anime.nextAiringEpisode
      ? `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`
      : anime.episodes ? `${anime.episodes} eps` : "";
    const details = [nextEp, score].filter(Boolean).join(" • ");
    return `**${i + 1}.** [${title}](https://anilist.co/anime/${anime.id})\n${details}`;
  }).join("\n\n");
  return new EmbedBuilder()
    .setTitle(`${season} ${year} — ${genre} Anime`)
    .setDescription(text).setColor(0xe67e22)
    .setFooter({ text: `${animeList.length} results • Reply with a number to add to your watchlist` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("genre")
    .setDescription("Browse this season's anime by genre")
    .addStringOption((opt) => opt.setName("name").setDescription("Genre (e.g. Action, Romance, Comedy)").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const genre = interaction.options.getString("name");
    let animeList;
    try { animeList = await fetchSeasonalByGenre(genre); } catch { return interaction.editReply("Could not fetch anime."); }
    const { season, year } = getCurrentSeason();
    if (!animeList?.length) return interaction.editReply(`No **${season} ${year}** anime found for genre "**${genre}**".`);

    store.animeCache[interaction.user.id] = animeList;
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("pick_anime").setPlaceholder("Add to watchlist...").addOptions(buildAnimeOptions(animeList));

    await interaction.editReply({
      embeds: [buildGenreEmbed(animeList, genre, season, year)],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  },

  async prefixRun(message, args) {
    const genre = args.join(" ");
    if (!genre) return message.reply("Usage: `tako genre <genre>` (e.g. `tako genre Action`)");
    let animeList;
    try { animeList = await fetchSeasonalByGenre(genre); } catch { return message.reply("Could not fetch anime."); }
    const { season, year } = getCurrentSeason();
    if (!animeList?.length) return message.reply(`No **${season} ${year}** anime found for genre "**${genre}**".`);

    const listed = animeList.slice(0, 10);
    await message.reply({ embeds: [buildGenreEmbed(listed, genre, season, year)] });

    const pick = await awaitNumber(message, "Which one?", listed.length);
    if (pick === null) return;
    const anime = listed[pick];
    const title = anime.title.english || anime.title.romaji;
    const userList = store.watchingMap[message.guildId][message.author.id] || [];
    if (userList.some((w) => w.id === anime.id)) return message.reply(`You're already watching **${title}**!`);
    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: message.author.username });
    store.watchingMap[message.guildId][message.author.id] = userList;
    return message.reply(`Added **${title}** to your watchlist!`);
  },
};
