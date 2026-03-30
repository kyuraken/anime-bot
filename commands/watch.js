const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { searchAnime } = require("../utils/anilist");
const { buildAnimeOptions, formatTimeUntilAiring } = require("../utils/format");
const { awaitNumber } = require("../utils/prefix");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Search for any anime by name and add to your watchlist")
    .addStringOption((opt) => opt.setName("query").setDescription("Anime name to search for").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const searchTerm = interaction.options.getString("query");
    let animeList;
    try { animeList = await searchAnime(searchTerm); } catch { return interaction.editReply("Could not search anime."); }
    if (!animeList?.length) return interaction.editReply(`No results for "**${searchTerm}**".`);

    store.animeCache[interaction.user.id] = animeList;
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("pick_anime")
      .setPlaceholder("Pick an anime to add to your watchlist...")
      .addOptions(buildAnimeOptions(animeList));

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(`Search: "${searchTerm}"`)
        .setDescription(`Found **${animeList.length}** result${animeList.length !== 1 ? "s" : ""}. Pick one to add!`)
        .setColor(0x3498db)],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  },

  async prefixRun(message, args) {
    const query = args.join(" ");
    if (!query) return message.reply("Usage: `tako watch <anime name>`");
    let animeList;
    try { animeList = await searchAnime(query); } catch { return message.reply("Could not search anime."); }
    if (!animeList?.length) return message.reply(`No results for "**${query}**".`);

    const listed = animeList.slice(0, 10);
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`Search: "${query}"`)
        .setColor(0x3498db)
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
    const userList = store.watchingMap[guildId][message.author.id] || [];
    if (userList.some((w) => w.id === anime.id)) return message.reply(`You're already watching **${title}**!`);

    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: message.author.username });
    store.watchingMap[guildId][message.author.id] = userList;

    const announceEmbed = new EmbedBuilder()
      .setAuthor({ name: `${message.member?.displayName || message.author.username} is now watching...`, iconURL: message.author.displayAvatarURL() })
      .setTitle(title).setURL(`https://anilist.co/anime/${anime.id}`)
      .setThumbnail(anime.coverImage.large || anime.coverImage.medium).setColor(0xe8467c);
    if (anime.genres?.length) announceEmbed.addFields({ name: "Genres", value: anime.genres.slice(0, 4).join(", "), inline: true });
    if (anime.averageScore) announceEmbed.addFields({ name: "Score", value: `⭐ ${anime.averageScore}%`, inline: true });
    if (anime.nextAiringEpisode) announceEmbed.addFields({ name: "Next Episode", value: `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`, inline: true });

    return message.channel.send({ embeds: [announceEmbed] });
  },
};
