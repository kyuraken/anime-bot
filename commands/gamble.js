const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const activeGambles = new Set(); // channelId

async function runGamble(channel) {
  if (activeGambles.has(channel.id)) {
    return channel.send("A gamble is already running in this channel!");
  }

  const secret = Math.floor(Math.random() * 100) + 1;
  activeGambles.add(channel.id);

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle("🎰 Takopii Gamble!")
      .setDescription("I've picked a number from **1 to 100**.\nEveryone gets **one guess** — type your number!\nI'll reveal the answer **5 seconds after the last guess**.")
      .setColor(0xe8467c)],
  });

  const guesses = new Map(); // userId → { guess, username }
  let timer;

  const collector = channel.createMessageCollector({ filter: (m) => !m.author.bot });

  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => collector.stop("timeout"), 5000);
  };

  // Start the initial timer — if nobody guesses at all within 30s, end it
  const idleTimer = setTimeout(() => collector.stop("idle"), 30000);

  collector.on("collect", (msg) => {
    const num = parseInt(msg.content);
    if (isNaN(num) || num < 1 || num > 100) return;

    if (guesses.has(msg.author.id)) {
      msg.react("❌").catch(() => {});
      return;
    }

    guesses.set(msg.author.id, { guess: num, username: msg.author.username });
    msg.react("✅").catch(() => {});
    clearTimeout(idleTimer);
    resetTimer();
  });

  collector.on("end", async (_, reason) => {
    activeGambles.delete(channel.id);
    clearTimeout(timer);
    clearTimeout(idleTimer);

    if (!guesses.size || reason === "idle") {
      return channel.send("Nobody guessed! The number was **" + secret + "**.");
    }

    // Find closest guesser(s)
    let minDiff = Infinity;
    for (const { guess } of guesses.values()) {
      const diff = Math.abs(guess - secret);
      if (diff < minDiff) minDiff = diff;
    }

    const winners = [...guesses.entries()]
      .filter(([, { guess }]) => Math.abs(guess - secret) === minDiff)
      .map(([userId, { guess, username }]) => ({ userId, guess, username }));

    const lines = [...guesses.entries()]
      .sort(([, a], [, b]) => Math.abs(a.guess - secret) - Math.abs(b.guess - secret))
      .map(([userId, { guess }]) => {
        const diff = Math.abs(guess - secret);
        const arrow = guess < secret ? "⬆️" : guess > secret ? "⬇️" : "🎯";
        return `<@${userId}> guessed **${guess}** ${arrow} (off by ${diff})`;
      });

    const winnerText = winners.length === 1
      ? `🏆 <@${winners[0].userId}> wins with **${winners[0].guess}**!`
      : `🏆 Tie! ${winners.map((w) => `<@${w.userId}>`).join(" & ")} both guessed **${winners[0].guess}**!`;

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("🎰 The number was: **" + secret + "**!")
        .setDescription(`${winnerText}\n\n${lines.join("\n")}`)
        .setColor(0x2ecc71)],
    });
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName("gamble").setDescription("Pick a number 1–100 — closest guesser wins!"),

  async execute(interaction) {
    await interaction.reply({ content: "Starting the gamble!", ephemeral: true });
    await runGamble(interaction.channel);
  },

  async prefixRun(message) {
    await runGamble(message.channel);
  },
};
