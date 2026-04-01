// Shared handler for the pick_anime select menu
// Used by: /watch, /genre, /recommend (and their tako equivalents)
const { EmbedBuilder } = require("discord.js");
const store = require("../utils/store");
const { formatTimeUntilAiring } = require("../utils/format");

module.exports = async function handlePickAnime(interaction) {
  await interaction.deferUpdate();

  const { guildId } = interaction;
  const selectedId = interaction.values[0];
  const cache = store.animeCache[interaction.user.id] || [];
  const anime = cache.find((a) => String(a.id) === selectedId);

  if (!anime) {
    return interaction.editReply({ content: "Couldn't find that anime. Try again.", components: [], embeds: [] });
  }

  const title = anime.title.english || anime.title.romaji;
  const userList = store.watchingMap[guildId][interaction.user.id] || [];

  if (userList.some((w) => w.id === anime.id)) {
    return interaction.editReply({ content: `You're already watching **${title}**!`, components: [], embeds: [] });
  }

  userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: interaction.user.username });
  store.watchingMap[guildId][interaction.user.id] = userList;

  const announceEmbed = new EmbedBuilder()
    .setAuthor({ name: `${interaction.user.displayName} is now watching...`, iconURL: interaction.user.displayAvatarURL() })
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setThumbnail(anime.coverImage.large || anime.coverImage.medium)
    .setColor(0xe8467c)
    .setFooter({ text: "Use /watch to add anime • /list to see your watchlist" });

  if (anime.genres?.length) announceEmbed.addFields({ name: "Genres", value: anime.genres.slice(0, 4).join(", "), inline: true });
  if (anime.averageScore) announceEmbed.addFields({ name: "Score", value: `⭐ ${anime.averageScore}%`, inline: true });
  if (anime.nextAiringEpisode) announceEmbed.addFields({
    name: "Next Episode",
    value: `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`,
    inline: true,
  });

  store.save();
  await interaction.editReply({ content: `Added **${title}** to your watchlist! (${userList.length} total)`, components: [], embeds: [] });
  await interaction.channel.send({ embeds: [announceEmbed] });
};
