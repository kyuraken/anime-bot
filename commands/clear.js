const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder().setName("clear").setDescription("Remove an anime from your watchlist"),

  async execute(interaction) {
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything!", ephemeral: true });

    const options = [
      { label: "Clear All", description: "Remove everything from your watchlist", value: "__clear_all__" },
      ...userList.map((w) => ({
        label: w.title.slice(0, 100),
        description: w.score ? `Your rating: ${w.score}/10` : "Not yet rated",
        value: w.id != null ? String(w.id) : w.title.slice(0, 100),
      })),
    ];

    await interaction.reply({
      content: "Which anime do you want to remove?",
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("clear_pick").setPlaceholder("Pick an anime to remove...").addOptions(options)
      )],
      ephemeral: true,
    });
  },

  async handleSelect(interaction) {
    await interaction.deferUpdate();
    const { guildId } = interaction;
    const selectedVal = interaction.values[0];
    const userList = store.watchingMap[guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.editReply({ content: "Your watchlist is already empty.", components: [], embeds: [] });

    if (selectedVal === "__clear_all__") {
      delete store.watchingMap[guildId][interaction.user.id];
      return interaction.editReply({ content: "Cleared your entire watchlist.", components: [], embeds: [] });
    }

    const idx = userList.findIndex((w) => String(w.id) === selectedVal || w.title === selectedVal);
    if (idx === -1) return interaction.editReply({ content: "Could not find that anime.", components: [], embeds: [] });

    const removed = userList.splice(idx, 1)[0];
    if (!userList.length) delete store.watchingMap[guildId][interaction.user.id];
    await interaction.editReply({ content: `Removed **${removed.title}** from your watchlist.`, components: [], embeds: [] });
  },

  async prefixRun(message) {
    const userList = store.watchingMap[message.guildId]?.[message.author.id];
    if (!userList?.length) return message.reply("You're not watching anything!");

    const { EmbedBuilder } = require("discord.js");
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle("Remove from watchlist").setColor(0xe74c3c)
        .setDescription(["**0.** Clear all", ...userList.map((w, i) => `**${i + 1}.** ${w.title}`)].join("\n"))
        .setFooter({ text: "Reply with a number (0 = clear all)" })],
    });

    let collected;
    try {
      collected = await message.channel.awaitMessages({
        filter: (m) => m.author.id === message.author.id && /^\d+$/.test(m.content.trim()),
        max: 1, time: 30000, errors: ["time"],
      });
    } catch { return message.reply("Timed out."); }

    const pick = parseInt(collected.first().content.trim());
    if (pick === 0) {
      delete store.watchingMap[message.guildId][message.author.id];
      return message.reply("Cleared your entire watchlist.");
    }
    if (pick < 1 || pick > userList.length) return message.reply("Invalid number.");
    const removed = userList.splice(pick - 1, 1)[0];
    if (!userList.length) delete store.watchingMap[message.guildId][message.author.id];
    return message.reply(`Removed **${removed.title}** from your watchlist.`);
  },
};
