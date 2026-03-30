const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

function buildCompareEmbed(nameA, nameB, shared) {
  return new EmbedBuilder()
    .setTitle(`${nameA} & ${nameB} both watch...`)
    .setColor(0x2ecc71)
    .setDescription(shared.map((w) => `• [${w.title}](https://anilist.co/anime/${w.id})`).join("\n"))
    .setFooter({ text: `${shared.length} anime in common` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("compare")
    .setDescription("See what anime you have in common with another user")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to compare with").setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser("user");
    if (target.id === interaction.user.id) return interaction.reply({ content: "You can't compare with yourself!", ephemeral: true });
    if (target.bot) return interaction.reply({ content: "Bots don't watch anime.", ephemeral: true });
    const myList = store.watchingMap[interaction.guildId]?.[interaction.user.id] || [];
    const theirList = store.watchingMap[interaction.guildId]?.[target.id] || [];
    if (!myList.length) return interaction.reply({ content: "You're not watching anything yet!", ephemeral: true });
    if (!theirList.length) return interaction.reply({ content: `**${target.displayName}** isn't watching anything yet!`, ephemeral: true });
    const shared = myList.filter((w) => new Set(theirList.map((t) => t.id)).has(w.id));
    if (!shared.length) return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${interaction.user.displayName} vs ${target.displayName}`).setDescription("No anime in common!").setColor(0xe74c3c)] });
    await interaction.reply({ embeds: [buildCompareEmbed(interaction.user.displayName, target.displayName, shared)] });
  },

  async prefixRun(message) {
    const target = message.mentions.users.first();
    if (!target) return message.reply("Usage: `tako compare @user`");
    const myList = store.watchingMap[message.guildId]?.[message.author.id] || [];
    const theirList = store.watchingMap[message.guildId]?.[target.id] || [];
    if (!myList.length) return message.reply("You're not watching anything yet!");
    if (!theirList.length) return message.reply(`**${target.username}** isn't watching anything yet!`);
    const shared = myList.filter((w) => new Set(theirList.map((t) => t.id)).has(w.id));
    if (!shared.length) return message.reply(`You and **${target.username}** have no anime in common!`);
    return message.reply({ embeds: [buildCompareEmbed(message.author.username, target.username, shared)] });
  },
};
