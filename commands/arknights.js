const { SlashCommandBuilder } = require("discord.js");

const RANTS = [
  "Arknights? ARKNIGHTS?! You dare mention that game in my presence?! Tower defense with a gacha system designed to drain your soul and your wallet simultaneously. Absolutely diabolical. I hate it.",
  "Oh you play Arknights? Cool, enjoy spending 300 pulls and getting nothing. The game looks at you, laughs, and gives you a 3-star operator you already have 9 copies of. Disgusting. I hate it.",
  "Arknights has the AUDACITY to have a good story, great music, and amazing character designs just so you get emotionally attached before the gacha destroys you. Manipulative. Evil. I hate it.",
  "The lore in Arknights is like 40,000 words per chapter and none of it makes sense until chapter 8 and by then you've already spent your rent money on originite prime. Criminal. I hate it.",
  "Arknights players be like 'the gameplay is so strategic' bro you have 12 maxed operators and I have Fang. There is no strategy. There is only pain. I hate it.",
  "They made the game hard, then made the meta operators limited, then put them on a schedule so you'd miss them, then re-ran them a year later. Pure psychological warfare. I hate it.",
  "You know what Arknights is? It's a beautiful, well-crafted game made by people who secretly hate you. Every update is a gift wrapped in suffering. I hate it so much.",
  "Arknights told me to pull on this banner. I did. I got E0 Stewardess. I have been thinking about it ever since. The game ruined me. I hate it.",
  "The music slaps, the art is incredible, the story genuinely makes you feel things — and the gacha rates are 2%. TWO PERCENT. They knew exactly what they were doing. I hate it.",
  "Arknights: the game where you fall in love with a character, find out they're limited, realize the rerun was 8 months ago, and just sit there. Staring. I hate it with every fiber of my being.",
];

module.exports = {
  data: new SlashCommandBuilder().setName("arknights").setDescription("Takopii shares his thoughts on Arknights"),

  async execute(interaction) {
    const rant = RANTS[Math.floor(Math.random() * RANTS.length)];
    await interaction.reply(`🐙 ${rant}`);
  },

  async prefixRun(message) {
    const rant = RANTS[Math.floor(Math.random() * RANTS.length)];
    await message.reply(`🐙 ${rant}`);
  },
};
