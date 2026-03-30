const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const SUBREDDIT = "okbuddybaka";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function isImageUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

async function fetchRandomImage() {
  const res = await fetch(
    `https://www.reddit.com/r/${SUBREDDIT}/hot.json?limit=100`,
    { headers: { "User-Agent": "discord-anime-bot/1.0" } }
  );

  if (!res.ok) throw new Error("FETCH_ERROR");

  const json = await res.json();
  const posts = json?.data?.children?.map((c) => c.data) ?? [];

  const imagePosts = posts.filter(
    (p) => !p.stickied && isImageUrl(p.url)
  );

  if (!imagePosts.length) return null;

  const post = imagePosts[Math.floor(Math.random() * imagePosts.length)];
  return {
    title: post.title,
    url: post.url,
    author: post.author,
    ups: post.ups,
    permalink: `https://reddit.com${post.permalink}`,
  };
}

function buildEmbed(post) {
  return new EmbedBuilder()
    .setTitle(post.title.slice(0, 256))
    .setURL(post.permalink)
    .setImage(post.url)
    .setColor(0xff4500)
    .setFooter({ text: `r/${SUBREDDIT} • u/${post.author} • ⬆️ ${post.ups.toLocaleString()}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sus")
    .setDescription("Post a random meme from r/okbuddybaka"),

  async execute(interaction) {
    await interaction.deferReply();
    let post;
    try {
      post = await fetchRandomImage();
    } catch {
      return interaction.editReply("Could not reach Reddit. Try again later.");
    }
    if (!post) return interaction.editReply("No image posts found. Try again!");
    await interaction.editReply({ embeds: [buildEmbed(post)] });
  },

  async prefixRun(message) {
    let post;
    try {
      post = await fetchRandomImage();
    } catch {
      return message.reply("Could not reach Reddit. Try again later.");
    }
    if (!post) return message.reply("No image posts found. Try again!");
    return message.reply({ embeds: [buildEmbed(post)] });
  },
};
