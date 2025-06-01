require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');
const { validateEnvironment } = require('./utils/validateEnv');
const scheduledJobs = require('./utils/scheduledJobs');
const fs = require('fs');
const path = require('path');

// 環境変数の検証
if (!validateEnvironment()) {
  logger.error('環境変数の検証に失敗しました。アプリケーションを終了します。');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();

function loadCommands() {
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

client.once('ready', () => {
  logger.info(`Logged in as ${client.user.tag}`);

  try {
    loadCommands();
    logger.info('All commands loaded successfully');
    
    // スケジュールジョブを開始
    scheduledJobs.start();
  } catch (error) {
    logger.error('Failed to load commands', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) {return;}

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

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Shutting down gracefully...');
  scheduledJobs.stop();
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Shutting down gracefully...');
  scheduledJobs.stop();
  client.destroy();
  process.exit(0);
});

// 環境変数検証は起動時に実行済みなので、ここでは直接ログイン
client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  logger.error('Failed to login to Discord', error);
  process.exit(1);
});
