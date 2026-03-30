const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { scoreStars } = require("../utils/format");
const store = require("../utils/store");

function buildProfileEmbed(username, userList, avatarURL) {
  return new EmbedBuilder()
    .setTitle(`${username}'s Watchlist`)
    .setThumbnail(avatarURL)
    .setColor(0x3498db)
    .setDescription(userList.map((w, i) => {
      const scoreStr = w.score ? ` — ${scoreStars(w.score)} (${w.score}/10)` : "";
      return `**${i + 1}.** [${w.title}](https://anilist.co/anime/${w.id})${scoreStr}`;
    }).join("\n"))
    .setFooter({ text: `${userList.length} anime` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View another user's watchlist")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to view").setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser("user");
    if (target.bot) return interaction.reply({ content: "Bots don't watch anime.", ephemeral: true });
    const userList = store.watchingMap[interaction.guildId]?.[target.id];
    if (!userList?.length) return interaction.reply({ content: `**${target.displayName}** isn't watching anything yet!`, ephemeral: true });
    await interaction.reply({ embeds: [buildProfileEmbed(target.displayName, userList, target.displayAvatarURL())] });
  },

  async prefixRun(message) {
    const target = message.mentions.users.first();
    if (!target) return message.reply("Usage: `tako profile @user`");
    const userList = store.watchingMap[message.guildId]?.[target.id];
    if (!userList?.length) return message.reply(`**${target.username}** isn't watching anything yet!`);
    return message.reply({ embeds: [buildProfileEmbed(target.username, userList, target.displayAvatarURL())] });
  },
};
