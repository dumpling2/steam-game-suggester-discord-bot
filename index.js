require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }
}

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}`);
  
  try {
    await loadCommands();
    logger.info('All commands loaded successfully');
  } catch (error) {
    logger.error('Failed to load commands', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`No command matching ${interaction.commandName} was found`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}`, error);
    
    const errorMessage = 'コマンドの実行中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection', error);
});

if (!process.env.DISCORD_BOT_TOKEN) {
  logger.error('DISCORD_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  logger.error('Failed to login to Discord', error);
  process.exit(1);
});