const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

function buildGroupEmbed(entries) {
  return new EmbedBuilder()
    .setTitle("Currently Watching on This Server")
    .setColor(0x1db954)
    .setDescription(entries.map(([uid, list]) => `<@${uid}> — ${list.map((w) => `**${w.title}**`).join(", ")}`).join("\n"))
    .setFooter({ text: "Use /watch to add anime • /clear to remove" });
}

module.exports = {
  data: new SlashCommandBuilder().setName("group").setDescription("See what everyone on this server is currently watching"),

  async execute(interaction) {
    const entries = Object.entries(store.watchingMap[interaction.guildId] || {});
    if (!entries.length) return interaction.reply({ content: "Nobody is watching anything yet!", ephemeral: true });
    await interaction.reply({ embeds: [buildGroupEmbed(entries)] });
  },

  async prefixRun(message) {
    const entries = Object.entries(store.watchingMap[message.guildId] || {});
    if (!entries.length) return message.reply("Nobody is watching anything yet!");
    return message.reply({ embeds: [buildGroupEmbed(entries)] });
  },
};
