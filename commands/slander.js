const { SlashCommandBuilder } = require("discord.js");

const ROASTS = [
  (name) => `${name} you absolute walnut, I've seen better decision making from a broken roomba. What is actually going on in that head of yours??`,
  (name) => `${name} is the human equivalent of a wet sock. Useless, uncomfortable, and nobody wants to deal with you.`,
  (name) => `bro ${name} genuinely has the personality of a stale cracker. not even a good cracker. the off-brand ones that taste like cardboard.`,
  (name) => `${name} out here acting tough but cries when their gacha pull is a 3-star. we know. we ALL know.`,
  (name) => `i asked god why he made ${name} and he said "my bad, that was an accident"`,
  (name) => `${name} your takes are so bad I genuinely think you do it on purpose. no one is naturally this wrong about everything.`,
  (name) => `${name} if brains were gas you wouldn't have enough to power a flea's go-kart around a cheerio.`,
  (name) => `the audacity of ${name} to wake up every morning, look in the mirror, and choose to be like THAT. respect the confidence I guess.`,
  (name) => `${name} is the reason they put instructions on shampoo bottles. rinse and repeat because clearly something isn't working.`,
  (name) => `${name} you're not a bad person, you're just a terrible one. there's a difference and you are firmly in the second category.`,
  (name) => `scientists have been studying ${name} for years trying to figure out how someone can be so consistently, impressively wrong. groundbreaking stuff.`,
  (name) => `${name} has the energy of someone who laughs at their own jokes before finishing them and the jokes are never funny.`,
  (name) => `bro ${name} what are you DOING. every day you wake up and choose violence against common sense. it's actually impressive at this point.`,
  (name) => `${name} is the type of person to bring a salad to a BBQ and then complain there's nothing to eat. insufferable.`,
  (name) => `i don't hate ${name}, i just think the world would be statistically more intelligent without their contributions to conversation.`,
];

async function getRandomMember(guild) {
  await guild.members.fetch();
  const humans = guild.members.cache.filter((m) => !m.user.bot);
  if (!humans.size) return null;
  const arr = [...humans.values()];
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slander")
    .setDescription("Takopii picks a random server member and absolutely destroys them"),

  async execute(interaction) {
    const member = await getRandomMember(interaction.guild);
    if (!member) return interaction.reply({ content: "No members to slander!", ephemeral: true });
    const name = member.displayName;
    const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)](name);
    await interaction.reply(`🐙 ${roast}`);
  },

  async prefixRun(message) {
    const member = await getRandomMember(message.guild);
    if (!member) return message.reply("No members to slander!");
    const name = member.displayName;
    const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)](name);
    await message.reply(`🐙 ${roast}`);
  },
};
