const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

// ── nekos.best API ───────────────────────────────────────────
// Free, no API key, returns image + character name + anime name

const CATEGORIES = ["neko", "waifu", "husbando", "kitsune"];

async function fetchRandomCharacter() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const res = await fetch(`https://nekos.best/api/v2/${category}`);
    const json = await res.json();
    const result = json.results?.[0];

    if (result?.character_name && result?.anime_name && result?.url) {
      return {
        name: result.character_name,
        anime: result.anime_name,
        image: result.url,
      };
    }
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

  let character;
  try {
    character = await fetchRandomCharacter();
  } catch {
    return channel.send("Could not reach the API. Try again later!");
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
