// ============================================================
// Anime Season Bot — index.js
// Commands:
//   /seasonal        — Browse current season anime with pagination
//   /watch           — Search any anime by name and add to watchlist
//   /list            — See your current watchlist
//   /profile @user   — View someone else's watchlist
//   /group           — See what everyone on the server is watching
//   /compare @user   — See anime you share with another user
//   /top             — Server leaderboard of most-watched anime
//   /recommend       — Recommendations based on your watchlist
//   /random          — Random anime from the current season
//   /genre <name>    — Browse seasonal anime by genre
//   /score <rating>  — Rate an anime you're watching (1-10)
//   /remind          — Get a DM when the next episode of an anime airs
//   /clear           — Remove anime from your watchlist
// ============================================================

require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

// watchingMap[guildId][userId] = [ { id, title, imageUrl, username, score? } ]
const watchingMap = {};

// linkedAccounts[guildId][userId] = { anilistUsername }
const linkedAccounts = {};

// Tracks active reminders to prevent duplicates: Set of "userId-animeId"
const activeReminders = new Set();

// ── AniList Helpers ──────────────────────────────────────────

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  let season;
  if (month <= 3) season = "WINTER";
  else if (month <= 6) season = "SPRING";
  else if (month <= 9) season = "SUMMER";
  else season = "FALL";
  return { season, year };
}

async function anilistFetch(query, variables = {}) {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

async function fetchSeasonalAnime(page = 1) {
  const { season, year } = getCurrentSeason();
  const query = `
    query {
      Page(page: ${page}, perPage: 25) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(season: ${season}, seasonYear: ${year}, type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          description(asHtml: false)
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  `;
  const json = await anilistFetch(query);
  return { media: json.data.Page.media, pageInfo: json.data.Page.pageInfo };
}

async function fetchSeasonalByGenre(genre) {
  const { season, year } = getCurrentSeason();
  const query = `
    query ($genre: String) {
      Page(page: 1, perPage: 25) {
        pageInfo { total }
        media(season: ${season}, seasonYear: ${year}, type: ANIME, genre: $genre, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  `;
  const json = await anilistFetch(query, { genre });
  return json.data.Page.media;
}

async function searchAnime(searchTerm) {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 25) {
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english }
          coverImage { large medium }
          episodes
          averageScore
          genres
          status
          description(asHtml: false)
          nextAiringEpisode { episode timeUntilAiring }
          studios(isMain: true) { nodes { name } }
          season
          seasonYear
        }
      }
    }
  `;
  const json = await anilistFetch(query, { search: searchTerm });
  return json.data.Page.media;
}

async function fetchAnimeById(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { english romaji }
        coverImage { medium }
        nextAiringEpisode { episode timeUntilAiring }
        status
      }
    }
  `;
  const json = await anilistFetch(query, { id });
  return json.data.Media;
}

async function fetchAniListWatching(anilistUsername) {
  const query = `
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME, status: CURRENT) {
        lists {
          entries {
            media {
              id
              title { english romaji }
              coverImage { medium }
              episodes
              averageScore
              nextAiringEpisode { episode timeUntilAiring }
            }
          }
        }
      }
    }
  `;
  const json = await anilistFetch(query, { userName: anilistUsername });
  if (json.errors) throw new Error(json.errors[0].message);
  const lists = json.data.MediaListCollection?.lists || [];
  return lists.flatMap((l) => l.entries.map((e) => e.media));
}

async function fetchRecommendations(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        recommendations(page: 1, perPage: 10, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              title { romaji english }
              coverImage { medium }
              averageScore
              genres
              episodes
              status
            }
          }
        }
      }
    }
  `;
  const json = await anilistFetch(query, { id: animeId });
  return json.data.Media.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter(Boolean);
}

// ── Formatting Helpers ───────────────────────────────────────

function formatTimeUntilAiring(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatStatus(status) {
  const map = {
    RELEASING: "🟢 Airing",
    FINISHED: "🔵 Finished",
    NOT_YET_RELEASED: "🟡 Upcoming",
    CANCELLED: "🔴 Cancelled",
    HIATUS: "🟠 Hiatus",
  };
  return map[status] || status;
}

function truncate(str, len) {
  if (!str) return "";
  str = str.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + "…";
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
    return {
      label: title,
      description: parts.join(" • ").slice(0, 100) || "No info available",
      value: String(anime.id),
    };
  });
}

function buildSeasonalListEmbed(animeList, pageInfo, season, year) {
  const listText = animeList.map((anime, i) => {
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
    .setDescription(listText)
    .setColor(0xe8467c)
    .setFooter({ text: "Use /watch to search and add anime to your watchlist" });
}

function buildAnimeEmbed(anime) {
  const title = anime.title.english || anime.title.romaji;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://anilist.co/anime/${anime.id}`)
    .setColor(0xe8467c)
    .setThumbnail(anime.coverImage.large || anime.coverImage.medium);

  if (anime.description) embed.setDescription(truncate(anime.description, 300));

  const fields = [];
  fields.push({ name: "Status", value: formatStatus(anime.status), inline: true });
  if (anime.episodes) fields.push({ name: "Episodes", value: `${anime.episodes}`, inline: true });
  if (anime.averageScore) fields.push({ name: "Score", value: `⭐ ${anime.averageScore}%`, inline: true });
  if (anime.genres?.length) fields.push({ name: "Genres", value: anime.genres.join(", "), inline: false });
  if (anime.studios?.nodes?.[0]) fields.push({ name: "Studio", value: anime.studios.nodes[0].name, inline: true });
  if (anime.nextAiringEpisode) {
    fields.push({
      name: "Next Episode",
      value: `Episode ${anime.nextAiringEpisode.episode} in **${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}**`,
      inline: false,
    });
  }
  embed.addFields(fields);
  return embed;
}

// ── Slash Command Definitions ────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("seasonal")
    .setDescription("Browse this season's anime"),

  new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Search for any anime by name and add to your watchlist")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Anime name to search for").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("See your current watchlist"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View another user's watchlist")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to view").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("group")
    .setDescription("See what everyone on this server is currently watching"),

  new SlashCommandBuilder()
    .setName("compare")
    .setDescription("See what anime you have in common with another user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to compare with").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("top")
    .setDescription("See the most popular anime on this server"),

  new SlashCommandBuilder()
    .setName("recommend")
    .setDescription("Get anime recommendations based on your watchlist"),

  new SlashCommandBuilder()
    .setName("random")
    .setDescription("Get a random anime from the current season"),

  new SlashCommandBuilder()
    .setName("genre")
    .setDescription("Browse this season's anime by genre")
    .addStringOption((opt) =>
      opt.setName("name").setDescription("Genre (e.g. Action, Romance, Comedy)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("score")
    .setDescription("Rate an anime you're watching (1-10)")
    .addNumberOption((opt) =>
      opt.setName("rating").setDescription("Your rating from 1.0 to 10.0 (e.g. 7.5)").setMinValue(1).setMaxValue(10).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Get a DM when the next episode of an anime airs"),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Remove an anime from your watchlist"),

  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your AniList account to sync your watching list")
    .addStringOption((opt) =>
      opt.setName("username").setDescription("Your AniList username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Unlink your AniList account"),

  new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sync your AniList watching list to the bot"),
].map((cmd) => cmd.toJSON());

// ── Bot Setup ────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("Slash commands registered globally");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
});

// ── Caches ───────────────────────────────────────────────────
client._animeCache = {};   // userId → anime array (for dropdowns)
client._pageCache = {};    // userId → { page, type }
client._selectedAnime = {}; // userId → last selected anime
client._pendingScore = {};  // userId → rating (for score_pick flow)

// ── Interaction Handler ──────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  const guildId = interaction.guildId;
  if (!watchingMap[guildId]) watchingMap[guildId] = {};

  // ── /seasonal ──────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "seasonal") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let result;
    try {
      result = await fetchSeasonalAnime(1);
    } catch {
      return interaction.editReply("Could not fetch seasonal anime. AniList might be down.");
    }

    const { media: animeList, pageInfo } = result;
    const { season, year } = getCurrentSeason();
    const embed = buildSeasonalListEmbed(animeList, pageInfo, season, year);

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("seasonal_prev").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("seasonal_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(!pageInfo.hasNextPage),
    );

    client._pageCache[interaction.user.id] = { page: 1, type: "seasonal" };
    await interaction.editReply({ embeds: [embed], components: [buttonRow] });
  }

  // ── /watch ─────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "watch") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const searchTerm = interaction.options.getString("query");
    let animeList;
    try {
      animeList = await searchAnime(searchTerm);
    } catch {
      return interaction.editReply("Could not search anime. AniList might be down.");
    }

    if (!animeList?.length) return interaction.editReply(`No results found for "**${searchTerm}**".`);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("pick_anime")
      .setPlaceholder("Pick an anime to add to your watchlist...")
      .addOptions(buildAnimeOptions(animeList));

    const embed = new EmbedBuilder()
      .setTitle(`Search: "${searchTerm}"`)
      .setDescription(`Found **${animeList.length}** result${animeList.length !== 1 ? "s" : ""}. Pick one to add to your watchlist!`)
      .setColor(0x3498db);

    client._animeCache[interaction.user.id] = animeList;
    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  }

  // ── /list ──────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "list") {
    const userList = watchingMap[guildId]?.[interaction.user.id];
    if (!userList?.length) {
      return interaction.reply({ content: "You're not watching anything yet! Use `/watch` to find anime.", flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.displayName}'s Watchlist`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setColor(0xe8467c)
      .setDescription(
        userList.map((w, i) => {
          const scoreStr = w.score ? ` — ${scoreStars(w.score)} (${w.score}/10)` : "";
          return `**${i + 1}.** [${w.title}](https://anilist.co/anime/${w.id})${scoreStr}`;
        }).join("\n")
      )
      .setFooter({ text: "Use /score to rate • /clear to remove • /watch to add more" });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ── /profile @user ─────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "profile") {
    const target = interaction.options.getUser("user");
    if (target.bot) return interaction.reply({ content: "Bots don't watch anime.", flags: MessageFlags.Ephemeral });

    const userList = watchingMap[guildId]?.[target.id];
    if (!userList?.length) {
      return interaction.reply({ content: `**${target.displayName}** isn't watching anything yet!`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${target.displayName}'s Watchlist`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0x3498db)
      .setDescription(
        userList.map((w, i) => {
          const scoreStr = w.score ? ` — ${scoreStars(w.score)} (${w.score}/10)` : "";
          return `**${i + 1}.** [${w.title}](https://anilist.co/anime/${w.id})${scoreStr}`;
        }).join("\n")
      )
      .setFooter({ text: `${userList.length} anime` });

    await interaction.reply({ embeds: [embed] });
  }

  // ── /compare @user ─────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "compare") {
    const target = interaction.options.getUser("user");
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "You can't compare with yourself!", flags: MessageFlags.Ephemeral });
    }
    if (target.bot) return interaction.reply({ content: "Bots don't watch anime.", flags: MessageFlags.Ephemeral });

    const myList = watchingMap[guildId]?.[interaction.user.id] || [];
    const theirList = watchingMap[guildId]?.[target.id] || [];

    if (!myList.length) return interaction.reply({ content: "You're not watching anything yet!", flags: MessageFlags.Ephemeral });
    if (!theirList.length) return interaction.reply({ content: `**${target.displayName}** isn't watching anything yet!`, flags: MessageFlags.Ephemeral });

    const theirIds = new Set(theirList.map((w) => w.id));
    const shared = myList.filter((w) => theirIds.has(w.id));

    if (!shared.length) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${interaction.user.displayName} vs ${target.displayName}`)
            .setDescription("You have no anime in common — time to share recommendations!")
            .setColor(0xe74c3c),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.displayName} & ${target.displayName} both watch...`)
      .setColor(0x2ecc71)
      .setDescription(shared.map((w) => `• [${w.title}](https://anilist.co/anime/${w.id})`).join("\n"))
      .setFooter({ text: `${shared.length} anime in common` });

    await interaction.reply({ embeds: [embed] });
  }

  // ── /group ─────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "group") {
    const entries = Object.entries(watchingMap[guildId] || {});
    if (!entries.length) {
      return interaction.reply({ content: "Nobody is watching anything yet! Use `/watch` to start.", flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setTitle("Currently Watching on This Server")
      .setColor(0x1db954)
      .setDescription(
        entries.map(([userId, list]) =>
          `<@${userId}> — ${list.map((w) => `**${w.title}**`).join(", ")}`
        ).join("\n")
      )
      .setFooter({ text: "Use /watch to add anime • /clear to remove" });

    await interaction.reply({ embeds: [embed] });
  }

  // ── /top ───────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "top") {
    const entries = Object.entries(watchingMap[guildId] || {});
    if (!entries.length) {
      return interaction.reply({ content: "Nobody is watching anything yet!", flags: MessageFlags.Ephemeral });
    }

    const animeCounts = {};
    for (const [, list] of entries) {
      for (const w of list) {
        if (!animeCounts[w.title]) animeCounts[w.title] = { count: 0, imageUrl: w.imageUrl, id: w.id };
        animeCounts[w.title].count++;
      }
    }

    const sorted = Object.entries(animeCounts).sort(([, a], [, b]) => b.count - a.count).slice(0, 10);
    const medals = ["🥇", "🥈", "🥉"];
    const description = sorted.map(([title, data], i) => {
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} [${title}](https://anilist.co/anime/${data.id}) — ${data.count} watcher${data.count !== 1 ? "s" : ""}`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("Most Popular Anime on This Server")
      .setDescription(description)
      .setColor(0xf1c40f)
      .setFooter({ text: `${entries.length} members watching anime` });

    if (sorted[0]?.[1]?.imageUrl) embed.setThumbnail(sorted[0][1].imageUrl);
    await interaction.reply({ embeds: [embed] });
  }

  // ── /recommend ─────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "recommend") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userList = watchingMap[guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.editReply("You're not watching anything yet! Use `/watch` first.");

    const base = userList[Math.floor(Math.random() * userList.length)];
    let recs;
    try {
      recs = await fetchRecommendations(base.id);
    } catch {
      return interaction.editReply("Could not fetch recommendations. Try again later.");
    }

    if (!recs?.length) return interaction.editReply(`No recommendations found for **${base.title}**.`);

    const options = recs.slice(0, 25).map((anime) => {
      const title = (anime.title.english || anime.title.romaji).slice(0, 100);
      const parts = [];
      if (anime.genres?.length) parts.push(anime.genres.slice(0, 2).join(", "));
      if (anime.episodes) parts.push(`${anime.episodes} eps`);
      if (anime.averageScore) parts.push(`⭐ ${anime.averageScore}%`);
      return { label: title, description: parts.join(" • ").slice(0, 100) || "No info", value: String(anime.id) };
    });

    const embed = new EmbedBuilder()
      .setTitle(`Recommendations based on: ${base.title}`)
      .setDescription(`Found **${recs.length}** recommendations. Pick one to add to your watchlist!`)
      .setColor(0x9b59b6)
      .setThumbnail(base.imageUrl);

    client._animeCache[interaction.user.id] = recs;
    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("pick_anime").setPlaceholder("Add to watchlist...").addOptions(options)
      )],
    });
  }

  // ── /random ────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "random") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let result;
    try {
      result = await fetchSeasonalAnime(1);
    } catch {
      return interaction.editReply("Could not fetch anime. AniList might be down.");
    }

    const anime = result.media[Math.floor(Math.random() * result.media.length)];
    const embed = buildAnimeEmbed(anime);
    embed.setAuthor({ name: "Random pick from this season!" });

    // Let them add it to their watchlist
    const addButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`random_add:${anime.id}`).setLabel("Add to Watchlist").setStyle(ButtonStyle.Success),
    );

    client._animeCache[interaction.user.id] = result.media;
    await interaction.editReply({ embeds: [embed], components: [addButton] });
  }

  // ── /genre ─────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "genre") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const genre = interaction.options.getString("name");
    let animeList;
    try {
      animeList = await fetchSeasonalByGenre(genre);
    } catch {
      return interaction.editReply("Could not fetch anime. AniList might be down.");
    }

    if (!animeList?.length) {
      const { season, year } = getCurrentSeason();
      return interaction.editReply(`No **${season} ${year}** anime found with genre "**${genre}**". Try another genre!`);
    }

    const { season, year } = getCurrentSeason();
    const listText = animeList.map((anime, i) => {
      const title = anime.title.english || anime.title.romaji;
      const score = anime.averageScore ? `⭐ ${anime.averageScore}%` : "";
      const nextEp = anime.nextAiringEpisode
        ? `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`
        : anime.episodes ? `${anime.episodes} eps` : "";
      const details = [nextEp, score].filter(Boolean).join(" • ");
      return `**${i + 1}.** [${title}](https://anilist.co/anime/${anime.id})\n${details}`;
    }).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`${season} ${year} — ${genre} Anime`)
      .setDescription(listText)
      .setColor(0xe67e22)
      .setFooter({ text: `${animeList.length} results • Use /watch to add anime to your watchlist` });

    // Also offer a dropdown to add directly
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("pick_anime")
      .setPlaceholder("Add one to your watchlist...")
      .addOptions(buildAnimeOptions(animeList));

    client._animeCache[interaction.user.id] = animeList;
    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(selectMenu)],
    });
  }

  // ── /score ─────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "score") {
    const rawRating = interaction.options.getNumber("rating");
    const rating = Math.round(rawRating * 10) / 10; // Round to one decimal place

    if (rating < 1 || rating > 10) {
      return interaction.reply({ content: "Rating must be between 1.0 and 10.0.", flags: MessageFlags.Ephemeral });
    }
    const userList = watchingMap[guildId]?.[interaction.user.id];

    if (!userList?.length) {
      return interaction.reply({ content: "You're not watching anything to rate! Use `/watch` first.", flags: MessageFlags.Ephemeral });
    }

    // If only one anime, rate it directly
    if (userList.length === 1) {
      userList[0].score = rating;
      return interaction.reply({
        content: `Rated **${userList[0].title}**: ${scoreStars(rating)} (${rating}/10)`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Multiple anime — show a dropdown to pick which one to rate
    client._pendingScore[interaction.user.id] = rating;

    const options = userList.map((w) => ({
      label: w.title.slice(0, 100),
      description: w.score ? `Currently: ${w.score}/10` : "Not yet rated",
      value: w.id != null ? String(w.id) : w.title.slice(0, 100),
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("score_pick")
      .setPlaceholder("Which anime are you rating?")
      .addOptions(options);

    await interaction.reply({
      content: `Which anime would you like to rate **${rating}/10**?`,
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── /remind ────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "remind") {
    const userList = watchingMap[guildId]?.[interaction.user.id];
    if (!userList?.length) {
      return interaction.reply({ content: "You're not watching anything yet! Use `/watch` first.", flags: MessageFlags.Ephemeral });
    }

    const options = userList.map((w) => ({
      label: w.title.slice(0, 100),
      description: activeReminders.has(`${interaction.user.id}-${w.id}`) ? "Reminder already set" : "Tap to set reminder",
      value: w.id != null ? String(w.id) : w.title.slice(0, 100),
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("remind_pick")
      .setPlaceholder("Pick an anime to get reminded about...")
      .addOptions(options);

    await interaction.reply({
      content: "Pick an anime and I'll DM you when the next episode airs!",
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── dropdown: pick anime to add to watchlist ───────────
  if (interaction.isStringSelectMenu() && interaction.customId === "pick_anime") {
    await interaction.deferUpdate();

    const selectedId = interaction.values[0];
    const cache = client._animeCache?.[interaction.user.id] || [];
    const anime = cache.find((a) => String(a.id) === selectedId);

    if (!anime) {
      return interaction.editReply({ content: "Couldn't find that anime. Try again.", components: [], embeds: [] });
    }

    const title = anime.title.english || anime.title.romaji;
    client._selectedAnime[interaction.user.id] = anime;

    const userList = watchingMap[guildId][interaction.user.id] || [];
    if (userList.some((w) => w.id === anime.id)) {
      return interaction.editReply({
        content: `You're already watching **${title}**!`,
        components: [],
        embeds: [],
      });
    }

    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: interaction.user.username });
    watchingMap[guildId][interaction.user.id] = userList;

    const announceEmbed = new EmbedBuilder()
      .setAuthor({ name: `${interaction.user.displayName} is now watching...`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(title)
      .setURL(`https://anilist.co/anime/${anime.id}`)
      .setThumbnail(anime.coverImage.large || anime.coverImage.medium)
      .setColor(0xe8467c)
      .setFooter({ text: "Use /watch to add anime • /list to see your watchlist" });

    if (anime.genres?.length) announceEmbed.addFields({ name: "Genres", value: anime.genres.slice(0, 4).join(", "), inline: true });
    if (anime.averageScore) announceEmbed.addFields({ name: "Score", value: `⭐ ${anime.averageScore}%`, inline: true });
    if (anime.nextAiringEpisode) {
      announceEmbed.addFields({
        name: "Next Episode",
        value: `Ep ${anime.nextAiringEpisode.episode} in ${formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}`,
        inline: true,
      });
    }

    await interaction.editReply({ content: `Added **${title}** to your watchlist! (${userList.length} total)`, components: [], embeds: [] });
    await interaction.channel.send({ embeds: [announceEmbed] });
  }

  // ── Dropdown: pick anime to clear ─────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === "clear_pick") {
    await interaction.deferUpdate();

    const selectedVal = interaction.values[0];
    const userList = watchingMap[guildId]?.[interaction.user.id];

    if (!userList?.length) {
      return interaction.editReply({ content: "Your watchlist is already empty.", components: [], embeds: [] });
    }

    if (selectedVal === "__clear_all__") {
      delete watchingMap[guildId][interaction.user.id];
      return interaction.editReply({ content: "Cleared your entire watchlist.", components: [], embeds: [] });
    }

    const idx = userList.findIndex((w) => String(w.id) === selectedVal || w.title === selectedVal);
    if (idx === -1) {
      return interaction.editReply({ content: "Could not find that anime in your list.", components: [], embeds: [] });
    }

    const removed = userList.splice(idx, 1)[0];
    if (userList.length === 0) delete watchingMap[guildId][interaction.user.id];

    await interaction.editReply({ content: `Removed **${removed.title}** from your watchlist.`, components: [], embeds: [] });
  }

  // ── Dropdown: pick anime to score ─────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === "score_pick") {
    await interaction.deferUpdate();

    const selectedVal = interaction.values[0];
    const rating = client._pendingScore[interaction.user.id];
    const userList = watchingMap[guildId]?.[interaction.user.id];

    if (!rating || !userList?.length) {
      return interaction.editReply({ content: "Something went wrong. Try `/score` again.", components: [], embeds: [] });
    }

    const entry = userList.find((w) => String(w.id) === selectedVal || w.title === selectedVal);
    if (!entry) {
      return interaction.editReply({ content: "Could not find that anime.", components: [], embeds: [] });
    }

    entry.score = rating;
    delete client._pendingScore[interaction.user.id];

    await interaction.editReply({
      content: `Rated **${entry.title}**: ${scoreStars(rating)} (${rating}/10)`,
      components: [],
      embeds: [],
    });
  }

  // ── Dropdown: pick anime for reminder ─────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === "remind_pick") {
    await interaction.deferUpdate();

    const selectedVal = interaction.values[0];
    const userList = watchingMap[guildId]?.[interaction.user.id];
    const entry = userList?.find((w) => String(w.id) === selectedVal || w.title === selectedVal);

    if (!entry) {
      return interaction.editReply({ content: "Could not find that anime.", components: [], embeds: [] });
    }

    const reminderKey = `${interaction.user.id}-${entry.id}`;
    if (activeReminders.has(reminderKey)) {
      return interaction.editReply({ content: `You already have a reminder set for **${entry.title}**!`, components: [], embeds: [] });
    }

    // Fetch fresh data to get current nextAiringEpisode
    let fresh;
    try {
      fresh = await fetchAnimeById(entry.id);
    } catch {
      return interaction.editReply({ content: "Could not fetch episode data. Try again later.", components: [], embeds: [] });
    }

    if (!fresh?.nextAiringEpisode) {
      return interaction.editReply({ content: `**${entry.title}** doesn't have a scheduled next episode yet.`, components: [], embeds: [] });
    }

    const { episode, timeUntilAiring } = fresh.nextAiringEpisode;
    const msUntilAiring = timeUntilAiring * 1000;

    activeReminders.add(reminderKey);

    setTimeout(async () => {
      activeReminders.delete(reminderKey);
      try {
        const user = await client.users.fetch(interaction.user.id);
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Episode ${episode} of **${entry.title}** is out!`)
              .setURL(`https://anilist.co/anime/${entry.id}`)
              .setColor(0xe8467c)
              .setDescription("Time to watch! Use `/list` to check your other ongoing anime.")
              .setThumbnail(entry.imageUrl),
          ],
        });
      } catch {
        // User may have DMs disabled — nothing we can do
      }
    }, msUntilAiring);

    await interaction.editReply({
      content: `Reminder set! I'll DM you when **Episode ${episode}** of **${entry.title}** airs (in ${formatTimeUntilAiring(timeUntilAiring)}).`,
      components: [],
      embeds: [],
    });
  }

  // ── Button: random add to watchlist ───────────────────
  if (interaction.isButton() && interaction.customId.startsWith("random_add:")) {
    await interaction.deferUpdate();

    const animeId = parseInt(interaction.customId.split(":")[1]);
    const cache = client._animeCache?.[interaction.user.id] || [];
    const anime = cache.find((a) => a.id === animeId);

    if (!anime) return interaction.editReply({ content: "Could not find that anime. Try `/random` again.", components: [] });

    const title = anime.title.english || anime.title.romaji;
    const userList = watchingMap[guildId][interaction.user.id] || [];

    if (userList.some((w) => w.id === anime.id)) {
      return interaction.editReply({ content: `You're already watching **${title}**!`, components: [] });
    }

    userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: interaction.user.username });
    watchingMap[guildId][interaction.user.id] = userList;

    await interaction.editReply({ content: `Added **${title}** to your watchlist!`, components: [] });
  }

  // ── pagination buttons ─────────────────────────────────
  if (interaction.isButton() && (interaction.customId === "seasonal_prev" || interaction.customId === "seasonal_next")) {
    await interaction.deferUpdate();

    const pageData = client._pageCache?.[interaction.user.id];
    if (!pageData || pageData.type !== "seasonal") return;

    const newPage = interaction.customId === "seasonal_next" ? pageData.page + 1 : pageData.page - 1;
    if (newPage < 1) return;

    let result;
    try {
      result = await fetchSeasonalAnime(newPage);
    } catch {
      return;
    }

    const { media: animeList, pageInfo } = result;
    if (!animeList.length) return;

    const { season, year } = getCurrentSeason();
    const embed = buildSeasonalListEmbed(animeList, pageInfo, season, year);

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("seasonal_prev").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(newPage <= 1),
      new ButtonBuilder().setCustomId("seasonal_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(!pageInfo.hasNextPage),
    );

    client._pageCache[interaction.user.id] = { page: newPage, type: "seasonal" };
    await interaction.editReply({ embeds: [embed], components: [buttonRow] });
  }

  // ── /clear ─────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "clear") {
    const userList = watchingMap[guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything!", flags: MessageFlags.Ephemeral });

    const options = [
      { label: "Clear All", description: "Remove everything from your watchlist", value: "__clear_all__" },
      ...userList.map((w) => ({
        label: w.title.slice(0, 100),
        description: w.score ? `Your rating: ${w.score}/10` : "Not yet rated",
        value: w.id != null ? String(w.id) : w.title.slice(0, 100),
      })),
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("clear_pick")
      .setPlaceholder("Pick an anime to remove...")
      .addOptions(options);

    await interaction.reply({
      content: "Which anime do you want to remove?",
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── /link ──────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "link") {
    const username = interaction.options.getString("username");

    // Verify the username exists on AniList before saving
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let animeList;
    try {
      animeList = await fetchAniListWatching(username);
    } catch {
      return interaction.editReply(`Could not find AniList user "**${username}**". Double-check your username and try again.`);
    }

    if (!linkedAccounts[guildId]) linkedAccounts[guildId] = {};
    linkedAccounts[guildId][interaction.user.id] = { anilistUsername: username };

    await interaction.editReply(
      `Linked to AniList account **${username}**! You're currently watching **${animeList.length}** anime on AniList. Use \`/sync\` to import them.`
    );
  }

  // ── /unlink ────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "unlink") {
    if (!linkedAccounts[guildId]?.[interaction.user.id]) {
      return interaction.reply({ content: "You don't have an AniList account linked.", flags: MessageFlags.Ephemeral });
    }
    const { anilistUsername } = linkedAccounts[guildId][interaction.user.id];
    delete linkedAccounts[guildId][interaction.user.id];
    await interaction.reply({ content: `Unlinked AniList account **${anilistUsername}**.`, flags: MessageFlags.Ephemeral });
  }

  // ── /sync ──────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === "sync") {
    const linked = linkedAccounts[guildId]?.[interaction.user.id];
    if (!linked) {
      return interaction.reply({ content: "You haven't linked an AniList account yet. Use `/link <username>` first.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let animeList;
    try {
      animeList = await fetchAniListWatching(linked.anilistUsername);
    } catch {
      return interaction.editReply("Could not fetch your AniList watching list. Try again later.");
    }

    if (!animeList.length) {
      return interaction.editReply("Your AniList watching list is empty — nothing to sync!");
    }

    const userList = watchingMap[guildId][interaction.user.id] || [];
    const existingIds = new Set(userList.map((w) => w.id));
    const added = [];

    for (const anime of animeList) {
      if (!existingIds.has(anime.id)) {
        const title = anime.title.english || anime.title.romaji;
        userList.push({ id: anime.id, title, imageUrl: anime.coverImage.medium, username: interaction.user.username });
        added.push(title);
      }
    }

    watchingMap[guildId][interaction.user.id] = userList;

    if (!added.length) {
      return interaction.editReply("Everything from your AniList is already in your watchlist — nothing new to add!");
    }

    const embed = new EmbedBuilder()
      .setTitle(`Synced from AniList: ${linked.anilistUsername}`)
      .setColor(0x02a9ff) // AniList blue
      .setDescription(added.map((t) => `• ${t}`).join("\n"))
      .setFooter({ text: `${added.length} anime added • Use /list to see your full watchlist` });

    await interaction.editReply({ embeds: [embed] });
  }
});

// ── Start the bot ────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
