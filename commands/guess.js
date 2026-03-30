const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

// ── Jikan API (paginated list — more reliable than /random) ──

async function fetchRandomCharacter() {
  // Pick from top 500 most-favourited characters (recognisable for guessing)
  const page = Math.floor(Math.random() * 500) + 1;

  const charRes = await fetch(
    `https://api.jikan.moe/v4/characters?order_by=favorites&sort=desc&page=${page}&limit=1`
  );
  const charJson = await charRes.json();
  const character = charJson.data?.[0];

  if (!character?.mal_id || !character?.name || !character?.images?.jpg?.image_url) return null;

  const id    = character.mal_id;
  const name  = character.name;
  const image = character.images.jpg.image_url;

  // Small delay to respect Jikan rate limit (3 req/s)
  await new Promise((r) => setTimeout(r, 400));

  // Fetch which anime this character appears in
  const animeRes = await fetch(`https://api.jikan.moe/v4/characters/${id}/anime`);
  const animeJson = await animeRes.json();
  const anime = animeJson.data?.[0]?.anime?.title;

  if (!anime) return null;

  return { name, image, anime };
}

// ── Helpers ──────────────────────────────────────────────────

function isCorrectGuess(guess, name) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const g = norm(guess);
  const full = norm(name);
  if (g === full) return true;
  // Also accept just first or last name (if longer than 2 chars)
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
    // Retry up to 3 times in case a page has no data
    for (let i = 0; i < 3; i++) {
      character = await fetchRandomCharacter();
      if (character) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    console.error("Guess error:", err);
    return channel.send("Could not reach Jikan API. Try again later!");
  }

  if (!character) return channel.send("Could not load a character. Try again!");

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
      break; // timed out
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
