const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { searchAnime, fetchAnimeDetails } = require("../utils/anilist");
const { buildAnimeOptions, formatTimeUntilAiring, formatStatus, truncate } = require("../utils/format");
const store = require("../utils/store");

function formatDate(d) {
  if (!d?.year) return null;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return d.month ? `${months[d.month - 1]} ${d.day || ""}, ${d.year}`.trim() : `${d.year}`;
}

function buildDetailEmbed(anime) {
  const title = anime.title.english || anime.title.romaji;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setColor(0xe8467c);

  if (anime.title.native && anime.title.native !== title) {
    embed.setAuthor({ name: anime.title.native });
  }

  if (anime.bannerImage) embed.setImage(anime.bannerImage);
  if (anime.coverImage?.large) embed.setThumbnail(anime.coverImage.large);
  if (anime.description) embed.setDescription(truncate(anime.description, 400));

  const fields = [];

  fields.push({ name: "Status", value: formatStatus(anime.status), inline: true });
  if (anime.format) fields.push({ name: "Format", value: anime.format.replace(/_/g, " "), inline: true });
  if (anime.episodes) fields.push({ name: "Episodes", value: `${anime.episodes}${anime.duration ? ` (${anime.duration} min each)` : ""}`, inline: true });

  if (anime.averageScore) fields.push({ name: "Average Score", value: `⭐ ${anime.averageScore}%`, inline: true });
  if (anime.popularity) fields.push({ name: "Popularity", value: `${anime.popularity.toLocaleString()} users`, inline: true });
  if (anime.favourites) fields.push({ name: "Favourites", value: `❤️ ${anime.favourites.toLocaleString()}`, inline: true });

  if (anime.genres?.length) fields.push({ name: "Genres", value: anime.genres.join(", "), inline: false });

  const topTags = anime.tags?.filter((t) => t.rank >= 60).slice(0, 5);
  if (topTags?.length) fields.push({ name: "Tags", value: topTags.map((t) => t.name).join(", "), inline: false });

  if (anime.studios?.nodes?.[0]) fields.push({ name: "Studio", value: anime.studios.nodes[0].name, inline: true });
  if (anime.source) fields.push({ name: "Source", value: anime.source.replace(/_/g, " "), inline: true });

  const startStr = formatDate(anime.startDate);
  const endStr = formatDate(anime.endDate);
  if (startStr) {
    const aired = endStr && endStr !== startStr ? `${startStr} — ${endStr}` : startStr;
    fields.push({ name: "Aired", value: aired, inline: true });
  }

  if (anime.season && anime.seasonYear) {
    fields.push({ name: "Season", value: `${anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} ${anime.seasonYear}`, inline: true });
  }

  if (anime.nextAiringEpisode) {
    fields.push({
      name: "Next Episode",
      value: `Episode ${anime.nextAiringEpisode.episode} in **${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}**`,
      inline: false,
    });
  }

  // Related anime (sequels, prequels)
  const relations = anime.relations?.edges
    ?.filter((e) => e.node.type === "ANIME" && ["SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY"].includes(e.relationType))
    .slice(0, 5);
  if (relations?.length) {
    fields.push({
      name: "Related Anime",
      value: relations.map((e) => `${e.relationType}: [${e.node.title.english || e.node.title.romaji}](https://anilist.co/anime/${e.node.id})`).join("\n"),
      inline: false,
    });
  }

  if (anime.trailer?.site === "youtube") {
    fields.push({ name: "Trailer", value: `[Watch on YouTube](https://youtube.com/watch?v=${anime.trailer.id})`, inline: false });
  }

  embed.addFields(fields);
  embed.setFooter({ text: "Use /watch or tako watch to add this anime to your watchlist" });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for an anime and view detailed information")
    .addStringOption((opt) => opt.setName("query").setDescription("Anime name to search for").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const searchTerm = interaction.options.getString("query");
    let animeList;
    try { animeList = await searchAnime(searchTerm); } catch { return interaction.editReply("Could not search anime."); }
    if (!animeList?.length) return interaction.editReply(`No results for "**${searchTerm}**".`);

    store.animeCache[interaction.user.id] = animeList;
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("search_pick")
      .setPlaceholder("Pick an anime to view info...")
      .addOptions(buildAnimeOptions(animeList));

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(`Search: "${searchTerm}"`)
        .setDescription(`Found **${animeList.length}** result${animeList.length !== 1 ? "s" : ""}. Pick one to see details!`)
        .setColor(0x3498db)],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  },

  async handleSelect(interaction) {
    await interaction.deferUpdate();
    const selectedId = parseInt(interaction.values[0]);
    let anime;
    try { anime = await fetchAnimeDetails(selectedId); } catch { return interaction.editReply({ content: "Could not fetch anime details.", components: [], embeds: [] }); }
    if (!anime) return interaction.editReply({ content: "Anime not found.", components: [], embeds: [] });
    await interaction.editReply({ embeds: [buildDetailEmbed(anime)], components: [] });
  },

  async prefixRun(message, args) {
    const query = args.join(" ");
    if (!query) return message.reply("Usage: `tako search <anime name>`");
    let animeList;
    try { animeList = await searchAnime(query); } catch { return message.reply("Could not search anime."); }
    if (!animeList?.length) return message.reply(`No results for "**${query}**".`);

    store.animeCache[message.author.id] = animeList;
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("search_pick")
      .setPlaceholder("Pick an anime to view info...")
      .addOptions(buildAnimeOptions(animeList));

    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`Search: "${query}"`)
        .setDescription(`Found **${animeList.length}** result${animeList.length !== 1 ? "s" : ""}. Pick one to see details!`)
        .setColor(0x3498db)],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  },
};
