const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

function buildQuoteEmbed(entry) {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setFooter({ text: `⭐ ${entry.stars} • Archived` })
    .setTimestamp(new Date(entry.timestamp));

  if (entry.authorTag) embed.setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatar || undefined });
  if (entry.content) embed.setDescription(entry.content);
  if (entry.imageUrl) embed.setImage(entry.imageUrl);

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder().setName("quote").setDescription("Get a random starred quote from the archive"),

  async execute(interaction) {
    const quotes = store.starboard[interaction.guildId];
    if (!quotes?.length) return interaction.reply({ content: "No archived quotes yet! React to messages with ⭐ (3 stars to archive).", ephemeral: true });
    const entry = quotes[Math.floor(Math.random() * quotes.length)];
    await interaction.reply({ embeds: [buildQuoteEmbed(entry)] });
  },

  async prefixRun(message) {
    const quotes = store.starboard[message.guildId];
    if (!quotes?.length) return message.reply("No archived quotes yet! React to messages with ⭐ (3 stars to archive).");
    const entry = quotes[Math.floor(Math.random() * quotes.length)];
    await message.reply({ embeds: [buildQuoteEmbed(entry)] });
  },
};
