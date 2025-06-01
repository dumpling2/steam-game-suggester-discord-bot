const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const steamApi = require('../../services/steamApi');
const rawgApi = require('../../services/rawgApi');
const recommendationService = require('../../services/recommendationService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('steam-rate')
    .setDescription('ゲームを評価する / Rate a game')
    .addStringOption(option =>
      option.setName('game_name')
        .setDescription('評価するゲーム名 / Game name to rate')
        .setRequired(true),
    )
    .addIntegerOption(option =>
      option.setName('rating')
        .setDescription('評価 (1-5) / Rating (1-5)')
        .setRequired(true)
        .addChoices(
          { name: '★☆☆☆☆ (1) 悪い', value: 1 },
          { name: '★★☆☆☆ (2) 微妙', value: 2 },
          { name: '★★★☆☆ (3) 普通', value: 3 },
          { name: '★★★★☆ (4) 良い', value: 4 },
          { name: '★★★★★ (5) 最高', value: 5 },
        ),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const gameName = interaction.options.getString('game_name');
      const rating = interaction.options.getInteger('rating');
      const userId = interaction.user.id;
      const username = interaction.user.username;

      logger.info('ゲーム評価リクエスト:', { userId, gameName, rating });

      // Steamでゲームを検索
      const foundApp = await steamApi.searchGameByName(gameName);
      let gameData = null;

      if (foundApp) {
        const gameDetails = await steamApi.getAppDetails(foundApp.appid);
        if (gameDetails) {
          gameData = steamApi.formatGameDetails(gameDetails);
        }
      }

      if (!gameData) {
        // RAWGでも検索
        const rawgResults = await rawgApi.searchGames({ search: gameName, page_size: 1 });
        if (rawgResults.results && rawgResults.results.length > 0) {
          const rawgGame = rawgResults.results[0];

          // Steamでの詳細を取得試行
          const steamInfo = await rawgApi.searchSteamGame(rawgGame.name);
          if (steamInfo && steamInfo.appId) {
            const steamDetails = await steamApi.getAppDetails(steamInfo.appId);
            if (steamDetails) {
              gameData = steamApi.formatGameDetails(steamDetails);
            }
          }

          // Steamで見つからない場合はRAWGデータを使用
          if (!gameData) {
            gameData = rawgApi.formatGameForEmbed(rawgGame);
          }
        }
      }

      if (!gameData) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ ゲームが見つかりません')
          .setDescription(`「${gameName}」というゲームが見つかりませんでした。\n別の名前で検索してみてください。`)
          .setFooter({ text: 'Steam Game Suggester' })
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      // 評価を記録
      await recommendationService.recordUserAction(
        userId,
        username,
        gameData,
        'rated',
        rating,
      );

      // 評価確認メッセージを作成
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const ratingText = ['', '悪い', '微妙', '普通', '良い', '最高'][rating];

      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('✅ 評価を記録しました')
        .setDescription(`**${gameData.name}**\n評価: ${stars} (${rating}/5) ${ratingText}`)
        .addFields(
          { name: 'ジャンル', value: gameData.genres ? gameData.genres.join(', ') : '不明', inline: true },
          { name: 'プラットフォーム', value: gameData.platform || 'Steam', inline: true },
        )
        .setThumbnail(gameData.image)
        .setFooter({ text: 'この評価は今後の推薦に活用されます' })
        .setTimestamp();

      // 類似ゲーム推薦を提案
      let similarGame = null;
      if (rating >= 4 && gameData.appId) {
        similarGame = await recommendationService.getSimilarGameRecommendation(gameData.appId);
      }

      if (similarGame) {
        embed.addFields({
          name: '🎮 似たようなゲームもおすすめです',
          value: `[${similarGame.name}](${similarGame.url})\n${similarGame.description ? similarGame.description.substring(0, 100) + '...' : ''}`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info('評価を記録完了:', { userId, gameId: gameData.appId || gameData.id, rating });

    } catch (error) {
      logger.error('ゲーム評価エラー:', error);

      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ エラーが発生しました')
        .setDescription('評価の記録中にエラーが発生しました。しばらくしてからもう一度お試しください。')
        .setFooter({ text: 'Steam Game Suggester' })
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
