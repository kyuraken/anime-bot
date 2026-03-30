const { SlashCommandBuilder } = require("discord.js");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder().setName("unlink").setDescription("Unlink your AniList account"),

  async execute(interaction) {
    const linked = store.linkedAccounts[interaction.guildId]?.[interaction.user.id];
    if (!linked) return interaction.reply({ content: "You don't have an AniList account linked.", ephemeral: true });
    delete store.linkedAccounts[interaction.guildId][interaction.user.id];
    await interaction.reply({ content: `Unlinked AniList account **${linked.anilistUsername}**.`, ephemeral: true });
  },

  async prefixRun(message) {
    const linked = store.linkedAccounts[message.guildId]?.[message.author.id];
    if (!linked) return message.reply("You don't have an AniList account linked.");
    delete store.linkedAccounts[message.guildId][message.author.id];
    return message.reply(`Unlinked AniList account **${linked.anilistUsername}**.`);
  },
};
