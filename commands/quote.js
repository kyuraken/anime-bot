const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

const BOARD_CHANNEL = "degeneral";

function buildStarboardEmbed(entry) {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setFooter({ text: `⭐ ${entry.stars} stars` })
    .setTimestamp(new Date(entry.timestamp));

  if (entry.authorTag) embed.setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatar || undefined });
  if (entry.content) embed.setDescription(entry.content);
  if (entry.imageUrl) embed.setImage(entry.imageUrl);

  return embed;
}

// Find the #degeneral channel in a guild
function findBoardChannel(guild) {
  return guild.channels.cache.find(
    (c) => c.name === BOARD_CHANNEL && c.isTextBased()
  );
}

// Post a single entry to #degeneral and mark it posted
async function postEntry(entry, guild) {
  const channel = findBoardChannel(guild);
  if (!channel) return false;
  await channel.send({ embeds: [buildStarboardEmbed(entry)] });
  entry.postedToBoard = true;
  return true;
}

module.exports = {
  data: new SlashCommandBuilder().setName("quote").setDescription("Get a random starred quote from the archive"),

  buildStarboardEmbed,
  findBoardChannel,
  postEntry,

  async execute(interaction) {
    const quotes = store.starboard[interaction.guildId];
    if (!quotes?.length) return interaction.reply({ content: "No archived quotes yet! React to messages with ⭐ (3 stars to archive).", ephemeral: true });
    const entry = quotes[Math.floor(Math.random() * quotes.length)];
    await interaction.reply({ embeds: [buildStarboardEmbed(entry)] });
  },

  async prefixRun(message) {
    const quotes = store.starboard[message.guildId];
    if (!quotes?.length) return message.reply("No archived quotes yet! React to messages with ⭐ (3 stars to archive).");
    const entry = quotes[Math.floor(Math.random() * quotes.length)];
    await message.reply({ embeds: [buildStarboardEmbed(entry)] });
  },

  // tako postquotes — posts all unposted archived quotes to #degeneral
  async prefixPostQuotes(message) {
    const quotes = store.starboard[message.guildId];
    if (!quotes?.length) return message.reply("No archived quotes yet!");

    const unposted = quotes.filter((e) => !e.postedToBoard);
    if (!unposted.length) return message.reply("All quotes have already been posted to #degeneral!");

    const channel = findBoardChannel(message.guild);
    if (!channel) return message.reply("Could not find a channel named **#degeneral**. Make sure it exists!");

    await message.reply(`Posting **${unposted.length}** archived quote${unposted.length !== 1 ? "s" : ""} to <#${channel.id}>...`);

    for (const entry of unposted) {
      await channel.send({ embeds: [buildStarboardEmbed(entry)] });
      entry.postedToBoard = true;
      await new Promise((r) => setTimeout(r, 600)); // small delay to avoid rate limits
    }
    store.save();
  },
};
