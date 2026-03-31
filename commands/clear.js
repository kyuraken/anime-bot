const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const store = require("../utils/store");

function buildClearDropdown(userList) {
  const options = [
    { label: "Clear All", description: "Remove everything from your watchlist", value: "__clear_all__" },
    ...userList.map((w) => ({
      label: w.title.slice(0, 100),
      description: w.score ? `Your rating: ${w.score}/10` : "Not yet rated",
      value: w.id != null ? String(w.id) : w.title.slice(0, 100),
    })),
  ];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId("clear_pick").setPlaceholder("Pick an anime to remove...").addOptions(options)
  );
}

module.exports = {
  data: new SlashCommandBuilder().setName("clear").setDescription("Remove an anime from your watchlist"),

  async execute(interaction) {
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything!", ephemeral: true });
    await interaction.reply({ content: "Which anime do you want to remove?", components: [buildClearDropdown(userList)], ephemeral: true });
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
    await message.reply({ content: "Which anime do you want to remove?", components: [buildClearDropdown(userList)] });
  },
};
