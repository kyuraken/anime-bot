const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Per-channel queue: channelId → shuffled URL list that drains until empty then refills
const queues = {}; // channelId → { remaining: [{ url, authorUsername }] }

async function buildPool(channel) {
  // Fetch 400 messages in batches of 100 (Discord API limit per request)
  const messages = new Map();
  let lastId;
  for (let i = 0; i < 4; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
    if (!batch.size) break;
    batch.forEach((msg, id) => messages.set(id, msg));
    lastId = batch.last()?.id;
  }
  const images = [];

  for (const msg of messages.values()) {
    if (msg.author.bot) continue;
    for (const att of msg.attachments.values()) {
      if (att.contentType?.startsWith("image/")) {
        images.push({ url: att.url, authorUsername: msg.author.username });
      }
    }
    for (const embed of msg.embeds) {
      if (embed.image?.url) images.push({ url: embed.image.url, authorUsername: msg.author.username });
    }
  }

  // Fisher-Yates shuffle
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }

  return images;
}

async function getNextImage(channel) {
  if (!queues[channel.id] || queues[channel.id].length === 0) {
    const pool = await buildPool(channel);
    if (!pool.length) return null;
    queues[channel.id] = pool;
  }
  return queues[channel.id].shift();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Reposts a random image from this channel — no repeats until all are shown"),

  async execute(interaction) {
    await interaction.deferReply();
    const pick = await getNextImage(interaction.channel);
    if (!pick) return interaction.editReply("No images found in the last 100 messages.");
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setImage(pick.url)
        .setColor(0xe8467c)
        .setFooter({ text: `Originally posted by ${pick.authorUsername}` })],
    });
  },

  async prefixRun(message) {
    const pick = await getNextImage(message.channel);
    if (!pick) return message.reply("No images found in the last 100 messages.");
    return message.reply({
      embeds: [new EmbedBuilder()
        .setImage(pick.url)
        .setColor(0xe8467c)
        .setFooter({ text: `Originally posted by ${pick.authorUsername}` })],
    });
  },
};
