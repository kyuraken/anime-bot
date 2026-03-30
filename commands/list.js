const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { scoreStars } = require("../utils/format");
const store = require("../utils/store");

function buildListEmbed(user, userList, avatarURL) {
  return new EmbedBuilder()
    .setTitle(`${user}'s Watchlist`)
    .setThumbnail(avatarURL)
    .setColor(0xe8467c)
    .setDescription(userList.map((w, i) => {
      const scoreStr = w.score ? ` — ${scoreStars(w.score)} (${w.score}/10)` : "";
      return `**${i + 1}.** [${w.title}](https://anilist.co/anime/${w.id})${scoreStr}`;
    }).join("\n"))
    .setFooter({ text: "Use /score to rate • /clear to remove • /watch to add more" });
}

module.exports = {
  data: new SlashCommandBuilder().setName("list").setDescription("See your current watchlist"),

  async execute(interaction) {
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything yet! Use `/watch` to find anime.", ephemeral: true });
    await interaction.reply({ embeds: [buildListEmbed(interaction.user.displayName, userList, interaction.user.displayAvatarURL())], ephemeral: true });
  },

  async prefixRun(message) {
    const userList = store.watchingMap[message.guildId]?.[message.author.id];
    if (!userList?.length) return message.reply("You're not watching anything yet! Use `tako watch <name>` to add anime.");
    return message.reply({ embeds: [buildListEmbed(message.member?.displayName || message.author.username, userList, message.author.displayAvatarURL())] });
  },
};
