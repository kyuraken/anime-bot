const { SlashCommandBuilder } = require("discord.js");

const FACES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

module.exports = {
  data: new SlashCommandBuilder().setName("dice").setDescription("Roll a dice (1–6)"),

  async execute(interaction) {
    const roll = Math.floor(Math.random() * 6) + 1;
    await interaction.reply(`🎲 ${FACES[roll - 1]} You rolled a **${roll}**!`);
  },

  async prefixRun(message) {
    const roll = Math.floor(Math.random() * 6) + 1;
    await message.reply(`🎲 ${FACES[roll - 1]} You rolled a **${roll}**!`);
  },
};
