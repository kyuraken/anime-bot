const { EmbedBuilder } = require("discord.js");

function formatTimeUntilAiring(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatStatus(status) {
  const map = {
    RELEASING: "🟢 Airing", FINISHED: "🔵 Finished",
    NOT_YET_RELEASED: "🟡 Upcoming", CANCELLED: "🔴 Cancelled", HIATUS: "🟠 Hiatus",
  };
  return map[status] || status;
}

function truncate(str, len) {
  if (!str) return "";
  str = str.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  return str.length <= len ? str : str.slice(0, len - 1) + "…";
}

function scoreStars(score) {
  const filled = Math.round(score / 2);
  return "⭐".repeat(filled) + "☆".repeat(5 - filled);
}

function buildAnimeOptions(animeList) {
  return animeList.slice(0, 25).map((anime) => {
    const title = (anime.title.english || anime.title.romaji).slice(0, 100);
    const parts = [];
    if (anime.genres?.length) parts.push(anime.genres.slice(0, 2).join(", "));
    if (anime.nextAiringEpisode) {
      parts.push(`Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`);
    } else if (anime.episodes) {
      parts.push(`${anime.episodes} eps`);
    }
    const studio = anime.studios?.nodes?.[0]?.name;
    if (studio) parts.push(studio);
    if (anime.averageScore) parts.push(`⭐ ${anime.averageScore}%`);
    return { label: title, description: parts.join(" • ").slice(0, 100) || "No info", value: String(anime.id) };
  });
}

function buildAnimeEmbed(anime) {
  const title = anime.title.english || anime.title.romaji;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setColor(0xe8467c)
    .setThumbnail(anime.coverImage?.large || anime.coverImage?.medium);
  if (anime.description) embed.setDescription(truncate(anime.description, 300));
  const fields = [{ name: "Status", value: formatStatus(anime.status), inline: true }];
  if (anime.episodes) fields.push({ name: "Episodes", value: `${anime.episodes}`, inline: true });
  if (anime.averageScore) fields.push({ name: "Score", value: `⭐ ${anime.averageScore}%`, inline: true });
  if (anime.genres?.length) fields.push({ name: "Genres", value: anime.genres.join(", "), inline: false });
  if (anime.studios?.nodes?.[0]) fields.push({ name: "Studio", value: anime.studios.nodes[0].name, inline: true });
  if (anime.nextAiringEpisode) fields.push({
    name: "Next Episode",
    value: `Episode ${anime.nextAiringEpisode.episode} in **${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}**`,
    inline: false,
  });
  embed.addFields(fields);
  return embed;
}

function buildSeasonalListEmbed(animeList, pageInfo, season, year) {
  const text = animeList.map((anime, i) => {
    const title = anime.title.english || anime.title.romaji;
    const score = anime.averageScore ? `⭐ ${anime.averageScore}%` : "";
    const genres = anime.genres?.slice(0, 2).join(", ") || "";
    const nextEp = anime.nextAiringEpisode
      ? `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`
      : anime.episodes ? `${anime.episodes} eps` : "";
    const details = [genres, nextEp, score].filter(Boolean).join(" • ");
    return `**${i + 1}.** [${title}](https://anilist.co/anime/${anime.id})\n${details}`;
  }).join("\n\n");

  return new EmbedBuilder()
    .setTitle(`${season} ${year} Anime — Page ${pageInfo.currentPage}/${pageInfo.lastPage}`)
    .setDescription(text)
    .setColor(0xe8467c)
    .setFooter({ text: "Use /watch or tako watch to add anime to your watchlist" });
}

module.exports = {
  formatTimeUntilAiring, formatStatus, truncate, scoreStars,
  buildAnimeOptions, buildAnimeEmbed, buildSeasonalListEmbed,
};
