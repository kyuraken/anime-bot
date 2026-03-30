const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const store = require("../utils/store");

function buildTopEmbed(entries) {
  const counts = {};
  for (const [, list] of entries)
    for (const w of list) {
      if (!counts[w.title]) counts[w.title] = { count: 0, imageUrl: w.imageUrl, id: w.id };
      counts[w.title].count++;
    }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b.count - a.count).slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  const embed = new EmbedBuilder()
    .setTitle("Most Popular Anime on This Server")
    .setColor(0xf1c40f)
    .setDescription(sorted.map(([title, data], i) =>
      `${medals[i] || `**${i + 1}.**`} [${title}](https://anilist.co/anime/${data.id}) — ${data.count} watcher${data.count !== 1 ? "s" : ""}`
    ).join("\n"))
    .setFooter({ text: `${entries.length} members watching anime` });
  if (sorted[0]?.[1]?.imageUrl) embed.setThumbnail(sorted[0][1].imageUrl);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder().setName("top").setDescription("See the most popular anime on this server"),

  async execute(interaction) {
    const entries = Object.entries(store.watchingMap[interaction.guildId] || {});
    if (!entries.length) return interaction.reply({ content: "Nobody is watching anything yet!", ephemeral: true });
    await interaction.reply({ embeds: [buildTopEmbed(entries)] });
  },

  async prefixRun(message) {
    const entries = Object.entries(store.watchingMap[message.guildId] || {});
    if (!entries.length) return message.reply("Nobody is watching anything yet!");
    return message.reply({ embeds: [buildTopEmbed(entries)] });
  },
};
