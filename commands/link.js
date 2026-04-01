const { SlashCommandBuilder } = require("discord.js");
const { fetchAniListWatching } = require("../utils/anilist");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your AniList account to sync your watching list")
    .addStringOption((opt) => opt.setName("username").setDescription("Your AniList username").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString("username");
    let animeList;
    try { animeList = await fetchAniListWatching(username); } catch {
      return interaction.editReply(`Could not find AniList user "**${username}**". Check your username and try again.`);
    }
    store.ensureGuild(interaction.guildId);
    store.linkedAccounts[interaction.guildId][interaction.user.id] = { anilistUsername: username };
    store.save();
    await interaction.editReply(`Linked to AniList account **${username}**! You're watching **${animeList.length}** anime there. Use \`/sync\` to import them.`);
  },

  async prefixRun(message, args) {
    const username = args[0];
    if (!username) return message.reply("Usage: `tako link <anilist username>`");
    let animeList;
    try { animeList = await fetchAniListWatching(username); } catch {
      return message.reply(`Could not find AniList user "**${username}**". Check the username and try again.`);
    }
    store.ensureGuild(message.guildId);
    store.linkedAccounts[message.guildId][message.author.id] = { anilistUsername: username };
    store.save();
    return message.reply(`Linked to AniList account **${username}**! Currently watching **${animeList.length}** anime. Use \`tako sync\` to import them.`);
  },
};
