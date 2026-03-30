require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, REST, Routes, Collection } = require("discord.js");
const store = require("./utils/store");
const handlePickAnime = require("./handlers/pickAnime");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── Load commands ────────────────────────────────────────────
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter((f) => f.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// ── Register slash commands on startup ───────────────────────
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: [...client.commands.values()].map((c) => c.data.toJSON()),
  });
  console.log("Slash commands registered");
});

// ── Slash commands & component interactions ──────────────────
client.on("interactionCreate", async (interaction) => {
  store.ensureGuild(interaction.guildId);

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "pick_anime") return handlePickAnime(interaction);
    if (interaction.customId === "clear_pick") return client.commands.get("clear").handleSelect(interaction);
    if (interaction.customId === "score_pick") return client.commands.get("score").handleSelect(interaction);
    if (interaction.customId === "remind_pick") return client.commands.get("remind").handleSelect(interaction, client);
  }

  if (interaction.isButton()) {
    if (["seasonal_prev", "seasonal_next"].includes(interaction.customId))
      return client.commands.get("seasonal").handleButton(interaction);
    if (interaction.customId.startsWith("random_add:"))
      return client.commands.get("random").handleButton(interaction);
  }
});

// ── Prefix commands (tako <command>) ─────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.toLowerCase().startsWith("tako")) return;

  store.ensureGuild(message.guildId);

  const args = message.content.slice(4).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  const command = client.commands.get(commandName);

  if (command?.prefixRun) await command.prefixRun(message, args, client);
});

client.login(process.env.DISCORD_TOKEN);
