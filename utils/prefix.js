// Waits for a numbered reply from the user (used in tako prefix commands)
async function awaitNumber(message, prompt, max) {
  await message.reply(prompt);
  let collected;
  try {
    collected = await message.channel.awaitMessages({
      filter: (m) => m.author.id === message.author.id && /^\d+$/.test(m.content.trim()),
      max: 1,
      time: 30000,
      errors: ["time"],
    });
  } catch {
    await message.reply("Timed out — try again.");
    return null;
  }
  const pick = parseInt(collected.first().content.trim());
  if (pick < 1 || pick > max) {
    await message.reply(`Please pick a number between 1 and ${max}.`);
    return null;
  }
  return pick - 1;
}

module.exports = { awaitNumber };
