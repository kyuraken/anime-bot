const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

// ── Jikan API ────────────────────────────────────────────────

async function fetchRandomCharacter() {
  // Retry up to 5 times to get a character with an image and an anime source
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.jikan.moe/v4/random/characters");
    const json = await res.json();
    const c = json.data;
    if (c?.images?.jpg?.image_url && c.anime?.length) return c;
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────

// Jikan returns names as "Surname, Firstname" — normalise both orders
function getNameVariants(rawName) {
  const parts = rawName.split(",").map((s) => s.trim());
  const variants = [rawName];
  if (parts.length === 2) {
    variants.push(parts[1]);                    // First name only
    variants.push(parts[0]);                    // Surname only
    variants.push(`${parts[1]} ${parts[0]}`);   // Firstname Surname
  }
  return variants.map((v) => v.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim());
}

function isCorrectGuess(guess, rawName) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const g = norm(guess);
  return getNameVariants(rawName).some((v) => v === g);
}

// Build a masked hint: "N_____ U_______"
function maskName(rawName, revealCount = 0) {
  return rawName.split(" ").map((word) =>
    word.split("").map((ch, i) => {
      if (ch === "," || ch === " ") return ch;
      return i < 1 + revealCount ? ch : "▢";
    }).join("")
  ).join(" ");
}

// ── Core game logic (shared between slash + prefix) ──────────

async function runGame(channel, starterId, starterName) {
  if (store.activeGames.has(channel.id)) {
    return channel.send("A guessing game is already running in this channel!");
  }

  let character;
  try { character = await fetchRandomCharacter(); } catch { return channel.send("Could not fetch a character. Try again!"); }
  if (!character) return channel.send("Could not find a valid character. Try again!");

  const rawName   = character.name;
  const image     = character.images.jpg.image_url;
  const animeName = character.anime[0]?.anime?.title || "Unknown";
  const nameLen   = rawName.replace(/,/g, "").trim().split(" ").map((w) => w.length).join(" + ");

  store.activeGames.add(channel.id);

  // ── Round 1: image + anime name ──────────────────────────
  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle("Who is this anime character? 🎌")
      .setImage(image)
      .setColor(0xe8467c)
      .addFields(
        { name: "From", value: `**${animeName}**`, inline: true },
        { name: "Name length", value: nameLen, inline: true },
      )
      .setFooter({ text: "Anyone can guess! You have 3 attempts • 30s each" })],
  });

  const hints = [
    maskName(rawName, 0),
    maskName(rawName, 1),
    maskName(rawName, 2),
  ];
  const hintLabels = ["First letter", "Two letters", "Three letters"];

  let winner = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    await channel.send(`💡 Hint: \`${hints[attempt]}\``);

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
    if (isCorrectGuess(msg.content, rawName)) {
      winner = msg.author;
      break;
    }

    if (attempt < 2) {
      await channel.send(`❌ Wrong! Next hint coming up... (${hintLabels[attempt + 1]})`);
    }
  }

  store.activeGames.delete(channel.id);

  // ── Result ───────────────────────────────────────────────
  if (winner) {
    if (!store.guessScores[channel.guildId]) store.guessScores[channel.guildId] = {};
    const scores = store.guessScores[channel.guildId];
    if (!scores[winner.id]) scores[winner.id] = { wins: 0, username: winner.username };
    scores[winner.id].wins++;
    scores[winner.id].username = winner.username;

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("🎉 Correct!")
        .setDescription(`<@${winner.id}> got it!\nThe character is **${rawName}** from **${animeName}**.\nThey now have **${scores[winner.id].wins}** win${scores[winner.id].wins !== 1 ? "s" : ""}!`)
        .setImage(image)
        .setColor(0x2ecc71)],
    });
  } else {
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("Nobody got it!")
        .setDescription(`The character was **${rawName}** from **${animeName}**.`)
        .setImage(image)
        .setColor(0xe74c3c)],
    });
  }
}

// ── Command export ───────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription("Start an anime character guessing game — anyone in the channel can answer!"),

  async execute(interaction) {
    await interaction.reply({ content: "Starting the game...", ephemeral: true });
    await runGame(interaction.channel, interaction.user.id, interaction.user.username);
  },

  async prefixRun(message) {
    await runGame(message.channel, message.author.id, message.author.username);
  },
};
