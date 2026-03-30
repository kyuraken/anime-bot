const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

async function getRandomImage(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const images = [];

  for (const msg of messages.values()) {
    for (const att of msg.attachments.values()) {
      if (att.contentType?.startsWith("image/")) {
        images.push({ url: att.url, author: msg.author });
      }
    }
    for (const embed of msg.embeds) {
      if (embed.image?.url) images.push({ url: embed.image.url, author: msg.author });
    }
  }

  return images.length ? images[Math.floor(Math.random() * images.length)] : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Reposts a random image from this channel"),

  async execute(interaction) {
    await interaction.deferReply();
    const pick = await getRandomImage(interaction.channel);
    if (!pick) return interaction.editReply("No images found in the last 100 messages.");
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setImage(pick.url)
        .setColor(0xe8467c)
        .setFooter({ text: `Originally posted by ${pick.author.username}` })],
    });
  },

  async prefixRun(message) {
    const pick = await getRandomImage(message.channel);
    if (!pick) return message.reply("No images found in the last 100 messages.");
    return message.reply({
      embeds: [new EmbedBuilder()
        .setImage(pick.url)
        .setColor(0xe8467c)
        .setFooter({ text: `Originally posted by ${pick.author.username}` })],
    });
  },
};
