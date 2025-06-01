const { SlashCommandBuilder } = require('discord.js');
const steamInfoHandler = require('./handlers/steamInfo');
const steamRecommendHandler = require('./handlers/steamRecommend');
const steamSaleHandler = require('./handlers/steamSale');
const steamGenreHandler = require('./handlers/steamGenre');
const steamTopRatedHandler = require('./handlers/steamTopRated');
const steamPriceHandler = require('./handlers/steamPrice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('steam')
    .setDescription('Steam ゲーム情報・おすすめボット')
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('特定のゲーム情報を検索します')
        .addStringOption(option =>
          option
            .setName('ゲーム名')
            .setDescription('検索したいゲームの名前')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('おすすめ')
        .setDescription('ランダムにゲームをおすすめします')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('random')
        .setDescription('ランダムにゲームをおすすめします（英語版）')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('お得な情報')
        .setDescription('現在のセール情報を表示します')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('genre')
        .setDescription('ジャンル別におすすめゲームを表示します')
        .addStringOption(option =>
          option
            .setName('ジャンル')
            .setDescription('ゲームのジャンル')
            .setRequired(true)
            .addChoices(
              { name: 'Action', value: 'action' },
              { name: 'Adventure', value: 'adventure' },
              { name: 'RPG', value: 'role-playing-games-rpg' },
              { name: 'Strategy', value: 'strategy' },
              { name: 'Simulation', value: 'simulation' },
              { name: 'Sports', value: 'sports' },
              { name: 'Racing', value: 'racing' },
              { name: 'Puzzle', value: 'puzzle' },
              { name: 'Shooter', value: 'shooter' },
              { name: 'Indie', value: 'indie' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('トップ評価')
        .setDescription('高評価のゲームをおすすめします')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('price')
        .setDescription('価格帯を指定してゲームを検索します')
        .addIntegerOption(option =>
          option
            .setName('最大価格')
            .setDescription('最大価格（円）')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('free')
        .setDescription('無料ゲームをおすすめします')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
    case 'info':
      await steamInfoHandler(interaction);
      break;
    case 'おすすめ':
    case 'random':
      await steamRecommendHandler(interaction);
      break;
    case 'お得な情報':
      await steamSaleHandler(interaction);
      break;
    case 'genre':
      await steamGenreHandler(interaction);
      break;
    case 'トップ評価':
      await steamTopRatedHandler(interaction);
      break;
    case 'price':
      await steamPriceHandler(interaction);
      break;
    case 'free':
      await steamPriceHandler(interaction, 0);
      break;
    default:
      await interaction.reply({ content: 'このサブコマンドはまだ実装されていません。', ephemeral: true });
    }
  },
};