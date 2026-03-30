const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

const KITSU_HEADERS = { Accept: "application/vnd.api+json" };

// ── Kitsu API ────────────────────────────────────────────────

async function fetchRandomCharacter() {
  // Get total character count first
  const countRes = await fetch("https://kitsu.io/api/edge/characters?page[limit]=1", { headers: KITSU_HEADERS });
  const countJson = await countRes.json();
  const total = Math.min(countJson.meta?.count || 5000, 10000);

  // Pick a random offset and fetch that character
  for (let attempt = 0; attempt < 5; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const charRes = await fetch(
      `https://kitsu.io/api/edge/characters?page[limit]=1&page[offset]=${offset}`,
      { headers: KITSU_HEADERS }
    );
    const charJson = await charRes.json();
    const character = charJson.data?.[0];

    if (!character) continue;
    const name = character.attributes?.name;
    const image = character.attributes?.image?.original;
    if (!name || !image) continue;

    // Fetch which anime this character is from
    const mediaRes = await fetch(
      `https://kitsu.io/api/edge/media-characters?filter[character_id]=${character.id}&include=media&page[limit]=1`,
      { headers: KITSU_HEADERS }
    );
    const mediaJson = await mediaRes.json();
    const media = mediaJson.included?.find((i) => i.type === "anime" || i.type === "manga");
    const anime = media?.attributes?.canonicalTitle
      || media?.attributes?.titles?.en
      || media?.attributes?.titles?.en_jp
      || null;

    if (!anime) continue; // Skip if we can't find the anime name

    return { name, image, anime };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function isCorrectGuess(guess, name) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const g = norm(guess);
  const full = norm(name);
  if (g === full) return true;
  return full.split(" ").some((part) => part.length > 2 && part === g);
}

function maskName(name, revealCount = 0) {
  return name.split(" ").map((word) =>
    word.split("").map((ch, i) => (i <= revealCount ? ch : "▢")).join("")
  ).join(" ");
}

// ── Core game ────────────────────────────────────────────────

async function runGame(channel) {
  if (store.activeGames.has(channel.id)) {
    return channel.send("A guessing game is already running in this channel!");
  }

  await channel.send("🎌 Loading a character...");

  let character;
  try {
    character = await fetchRandomCharacter();
  } catch (err) {
    return channel.send("Could not reach Kitsu API. Try again later!");
  }

  if (!character) return channel.send("Could not find a valid character. Try again!");

  const { name, image, anime } = character;
  const wordLengths = name.split(" ").map((w) => w.length).join(" + ");

  store.activeGames.add(channel.id);

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle("Who is this anime character? 🎌")
      .setImage(image)
      .setColor(0xe8467c)
      .addFields(
        { name: "From", value: `**${anime}**`, inline: true },
        { name: "Name length", value: `${wordLengths} letters`, inline: true },
      )
      .setFooter({ text: "Anyone can guess! 3 attempts • 30s each • more letters revealed each round" })],
  });

  let winner = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    await channel.send(`💡 Hint: \`${maskName(name, attempt)}\``);

    let collected;
    try {
      collected = await channel.awaitMessages({
        filter: (m) => !m.author.bot,
        max: 1,
        time: 30000,
        errors: ["time"],
      });
    } catch {
      break;
    }

    const msg = collected.first();
    if (isCorrectGuess(msg.content, name)) {
      winner = msg.author;
      break;
    }

    if (attempt < 2) await channel.send("❌ Not quite! Here's a better hint...");
  }

  store.activeGames.delete(channel.id);

  if (winner) {
    if (!store.guessScores[channel.guildId]) store.guessScores[channel.guildId] = {};
    const scores = store.guessScores[channel.guildId];
    if (!scores[winner.id]) scores[winner.id] = { wins: 0, username: winner.username };
    scores[winner.id].wins++;
    scores[winner.id].username = winner.username;

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("🎉 Correct!")
        .setDescription(`<@${winner.id}> got it!\nThe character is **${name}** from **${anime}**.\nThey now have **${scores[winner.id].wins}** win${scores[winner.id].wins !== 1 ? "s" : ""}!`)
        .setImage(image)
        .setColor(0x2ecc71)],
    });
  } else {
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("Nobody got it!")
        .setDescription(`The character was **${name}** from **${anime}**.`)
        .setImage(image)
        .setColor(0xe74c3c)],
    });
  }
}

// ── Export ───────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription("Start an anime character guessing game — anyone can answer!"),

  async execute(interaction) {
    await interaction.reply({ content: "Starting the game!", ephemeral: true });
    await runGame(interaction.channel);
  },

  async prefixRun(message) {
    await runGame(message.channel);
  },
};
