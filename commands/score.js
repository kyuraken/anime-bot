const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { scoreStars } = require("../utils/format");
const store = require("../utils/store");

function buildScoreDropdown(userList) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId("score_pick").setPlaceholder("Which anime are you rating?")
      .addOptions(userList.map((w) => ({
        label: w.title.slice(0, 100),
        description: w.score ? `Currently: ${w.score}/10` : "Not yet rated",
        value: w.id != null ? String(w.id) : w.title.slice(0, 100),
      })))
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("score")
    .setDescription("Rate an anime you're watching (1.0–10.0)")
    .addNumberOption((opt) => opt.setName("rating").setDescription("Your rating (e.g. 7.5)").setMinValue(1).setMaxValue(10).setRequired(true)),

  async execute(interaction) {
    const rating = Math.round(interaction.options.getNumber("rating") * 10) / 10;
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything to rate!", ephemeral: true });

    if (userList.length === 1) {
      userList[0].score = rating;
      return interaction.reply({ content: `Rated **${userList[0].title}**: ${scoreStars(rating)} (${rating}/10)`, ephemeral: true });
    }

    store.pendingScore[interaction.user.id] = rating;
    await interaction.reply({
      content: `Which anime would you like to rate **${rating}/10**?`,
      components: [buildScoreDropdown(userList)],
      ephemeral: true,
    });
  },

  async handleSelect(interaction) {
    await interaction.deferUpdate();
    const rating = store.pendingScore[interaction.user.id];
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!rating || !userList?.length) return interaction.editReply({ content: "Something went wrong. Try `/score` again.", components: [], embeds: [] });
    const entry = userList.find((w) => String(w.id) === interaction.values[0] || w.title === interaction.values[0]);
    if (!entry) return interaction.editReply({ content: "Could not find that anime.", components: [], embeds: [] });
    entry.score = rating;
    delete store.pendingScore[interaction.user.id];
    await interaction.editReply({ content: `Rated **${entry.title}**: ${scoreStars(rating)} (${rating}/10)`, components: [], embeds: [] });
  },

  async prefixRun(message, args) {
    const rawRating = parseFloat(args[0]);
    if (isNaN(rawRating) || rawRating < 1 || rawRating > 10) return message.reply("Usage: `tako score <1.0–10.0>` (e.g. `tako score 8.5`)");
    const rating = Math.round(rawRating * 10) / 10;
    const userList = store.watchingMap[message.guildId]?.[message.author.id];
    if (!userList?.length) return message.reply("You're not watching anything to rate!");

    if (userList.length === 1) {
      userList[0].score = rating;
      return message.reply(`Rated **${userList[0].title}**: ${scoreStars(rating)} (${rating}/10)`);
    }

    store.pendingScore[message.author.id] = rating;
    await message.reply({
      content: `Which anime would you like to rate **${rating}/10**?`,
      components: [buildScoreDropdown(userList)],
    });
  },
};
