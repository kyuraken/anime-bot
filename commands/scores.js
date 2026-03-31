const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

function buildScoresEmbed(guildId) {
  const scores = store.guessScores[guildId] || {};
  const entries = Object.entries(scores).sort(([, a], [, b]) => b.wins - a.wins).slice(0, 10);
  if (!entries.length) return null;

  const medals = ["🥇", "🥈", "🥉"];
  return new EmbedBuilder()
    .setTitle("🐙 Tako Points Leaderboard")
    .setColor(0xe8467c)
    .setDescription(entries.map(([userId, data], i) =>
      `${medals[i] || `**${i + 1}.**`} <@${userId}> — **${data.wins}** tako point${data.wins !== 1 ? "s" : ""}`
    ).join("\n"));
}

module.exports = {
  data: new SlashCommandBuilder().setName("scores").setDescription("See the tako points leaderboard"),

  async execute(interaction) {
    const embed = buildScoresEmbed(interaction.guildId);
    if (!embed) return interaction.reply({ content: "No tako points yet! Start a game with `/guess`.", ephemeral: true });
    await interaction.reply({ embeds: [embed] });
  },

  async prefixRun(message) {
    const embed = buildScoresEmbed(message.guildId);
    if (!embed) return message.reply("No tako points yet! Start a game with `tako guess`.");
    return message.reply({ embeds: [embed] });
  },
};
