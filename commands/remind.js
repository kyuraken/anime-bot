const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { fetchAnimeById } = require("../utils/anilist");
const { formatTimeUntilAiring } = require("../utils/format");
const store = require("../utils/store");

module.exports = {
  data: new SlashCommandBuilder().setName("remind").setDescription("Get a DM when the next episode of an anime airs"),

  async execute(interaction) {
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    if (!userList?.length) return interaction.reply({ content: "You're not watching anything yet! Use `/watch` first.", ephemeral: true });

    const options = userList.map((w) => ({
      label: w.title.slice(0, 100),
      description: store.activeReminders.has(`${interaction.user.id}-${w.id}`) ? "Reminder already set" : "Tap to set reminder",
      value: w.id != null ? String(w.id) : w.title.slice(0, 100),
    }));

    await interaction.reply({
      content: "Pick an anime and I'll DM you when the next episode airs!",
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("remind_pick").setPlaceholder("Pick an anime...").addOptions(options)
      )],
      ephemeral: true,
    });
  },

  async handleSelect(interaction, client) {
    await interaction.deferUpdate();
    const selectedVal = interaction.values[0];
    const userList = store.watchingMap[interaction.guildId]?.[interaction.user.id];
    const entry = userList?.find((w) => String(w.id) === selectedVal || w.title === selectedVal);
    if (!entry) return interaction.editReply({ content: "Could not find that anime.", components: [], embeds: [] });

    const reminderKey = `${interaction.user.id}-${entry.id}`;
    if (store.activeReminders.has(reminderKey)) {
      return interaction.editReply({ content: `You already have a reminder set for **${entry.title}**!`, components: [], embeds: [] });
    }

    let fresh;
    try { fresh = await fetchAnimeById(entry.id); } catch { return interaction.editReply({ content: "Could not fetch episode data.", components: [], embeds: [] }); }
    if (!fresh?.nextAiringEpisode) return interaction.editReply({ content: `**${entry.title}** doesn't have a scheduled next episode yet.`, components: [], embeds: [] });

    const { episode, timeUntilAiring } = fresh.nextAiringEpisode;
    store.activeReminders.add(reminderKey);

    setTimeout(async () => {
      store.activeReminders.delete(reminderKey);
      try {
        const user = await client.users.fetch(interaction.user.id);
        await user.send({
          embeds: [new EmbedBuilder()
            .setTitle(`Episode ${episode} of **${entry.title}** is out!`)
            .setURL(`https://anilist.co/anime/${entry.id}`)
            .setColor(0xe8467c)
            .setDescription("Time to watch! Use `/list` to check your other ongoing anime.")
            .setThumbnail(entry.imageUrl)],
        });
      } catch { /* DMs disabled — nothing we can do */ }
    }, timeUntilAiring * 1000);

    await interaction.editReply({
      content: `Reminder set! I'll DM you when **Episode ${episode}** of **${entry.title}** airs (in ${formatTimeUntilAiring(timeUntilAiring)}).`,
      components: [], embeds: [],
    });
  },
};
