const rawgApi = require('../../services/rawgApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const recommendationService = require('../../services/recommendationService');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamGenre(interaction) {
  const genre = interaction.options.getString('ジャンル');
  const userId = interaction.user.id;
  const username = interaction.user.username;

  await interaction.deferReply();

  try {
    logger.info('Getting personalized game by genre', { genre, userId });

    // まず個人化された推薦を試す
    let gameData = await recommendationService.getGenreBasedRecommendation(userId, genre);

    // 個人化推薦が失敗した場合はランダム選択にフォールバック
    if (!gameData) {
      const randomGame = await rawgApi.getRandomGameByGenre(genre);
      if (randomGame) {
        gameData = rawgApi.formatGameForEmbed(randomGame);
      }
    }

    if (!gameData) {
      const noResultEmbed = new EmbedBuilder()
        .setTitle('ジャンル検索結果')
        .setDescription(`ジャンル「${genre}」のゲームが見つかりませんでした。`)
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noResultEmbed] });
      return;
    }

    // ユーザーアクションを記録
    await recommendationService.recordUserAction(
      userId,
      username,
      gameData,
      'viewed',
    ).catch(err => logger.error('Failed to record user action:', err));

    const embed = new EmbedBuilder()
      .setTitle(gameData.name)
      .setDescription(gameData.description ? gameData.description.substring(0, 300) + (gameData.description.length > 300 ? '...' : '') : 'ゲームの説明がありません。')
      .setColor(EMBED_COLORS.INFO)
      .setImage(gameData.image || gameData.headerImage)
      .setTimestamp()
      .setFooter({ text: gameData.platform === 'Steam' ? 'Data from Steam' : 'Data from RAWG' });

    if (gameData.genres && gameData.genres.length > 0) {
      embed.addFields({
        name: 'ジャンル',
        value: gameData.genres.join(', '),
        inline: true,
      });
    }

    if (gameData.rating) {
      embed.addFields({
        name: '評価',
        value: gameData.rating,
        inline: true,
      });
    }

    if (gameData.metacritic) {
      embed.addFields({
        name: 'メタスコア',
        value: gameData.metacritic,
        inline: true,
      });
    }

    if (gameData.releaseDate) {
      embed.addFields({
        name: 'リリース日',
        value: gameData.releaseDate,
        inline: true,
      });
    }

    if (gameData.platforms && gameData.platforms.length > 0) {
      embed.addFields({
        name: 'プラットフォーム',
        value: gameData.platforms.slice(0, 3).join(', '),
        inline: true,
      });
    }

    if (gameData.price) {
      embed.addFields({
        name: '価格',
        value: gameData.price,
        inline: true,
      });
    }

    // Steam URLがある場合は設定
    if (gameData.url) {
      embed.setURL(gameData.url);
    }

    let steamButton = null;
    if (gameData.url && gameData.url.includes('store.steampowered.com')) {
      steamButton = new ButtonBuilder()
        .setLabel('Steamストアで見る')
        .setStyle(ButtonStyle.Link)
        .setURL(gameData.url)
        .setEmoji('🛒');
    }

    const components = [];
    const row1 = new ActionRowBuilder();

    row1.addComponents(
      new ButtonBuilder()
        .setCustomId('recommend_another_genre')
        .setLabel(`別の${genre}ゲームをおすすめ`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
    );

    if (steamButton) {
      row1.addComponents(steamButton);
    }

    // 評価ボタンの追加
    const row2 = new ActionRowBuilder();
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId('rate_game_good')
        .setLabel('👍 いいね')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rate_game_bad')
        .setLabel('👎 よくない')
        .setStyle(ButtonStyle.Danger),
    );

    components.push(row1, row2);

    const response = await interaction.editReply({
      embeds: [embed],
      components: components,
    });

    let currentGame = gameData;

    const collector = response.createMessageComponentCollector({
      filter: i => ['recommend_another_genre', 'rate_game_good', 'rate_game_bad'].includes(i.customId),
      time: 300000,
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      if (i.customId === 'rate_game_good' || i.customId === 'rate_game_bad') {
        await i.deferReply({ ephemeral: true });

        const rating = i.customId === 'rate_game_good' ? 5 : 1;

        try {
          await recommendationService.recordUserAction(
            userId,
            username,
            currentGame,
            'rated',
            rating,
          );

          await i.editReply({
            content: `✅ ${currentGame.name}を${rating === 5 ? '高評価' : '低評価'}として記録しました。今後の推薦に反映されます。`,
            ephemeral: true,
          });
        } catch (error) {
          logger.error('Failed to record rating:', error);
          await i.editReply({
            content: '❌ 評価の記録に失敗しました。',
            ephemeral: true,
          });
        }
        return;
      }

      await i.deferUpdate();

      try {
        // 新しい個人化推薦を取得
        let newGameData = await recommendationService.getGenreBasedRecommendation(userId, genre);

        if (!newGameData) {
          const newGame = await rawgApi.getRandomGameByGenre(genre);
          if (newGame) {
            newGameData = rawgApi.formatGameForEmbed(newGame);
          }
        }

        if (newGameData) {
          currentGame = newGameData;

          // 新しいゲームのアクションを記録
          await recommendationService.recordUserAction(
            userId,
            username,
            newGameData,
            'viewed',
          ).catch(err => logger.error('Failed to record user action:', err));

          const newEmbed = new EmbedBuilder()
            .setTitle(newGameData.name)
            .setDescription(newGameData.description ? newGameData.description.substring(0, 300) + (newGameData.description.length > 300 ? '...' : '') : 'ゲームの説明がありません。')
            .setColor(EMBED_COLORS.INFO)
            .setImage(newGameData.image || newGameData.headerImage)
            .setTimestamp()
            .setFooter({ text: newGameData.platform === 'Steam' ? 'Data from Steam' : 'Data from RAWG' });

          if (newGameData.genres && newGameData.genres.length > 0) {
            newEmbed.addFields({
              name: 'ジャンル',
              value: newGameData.genres.join(', '),
              inline: true,
            });
          }

          if (newGameData.rating) {
            newEmbed.addFields({
              name: '評価',
              value: newGameData.rating,
              inline: true,
            });
          }

          if (newGameData.releaseDate) {
            newEmbed.addFields({
              name: 'リリース日',
              value: newGameData.releaseDate,
              inline: true,
            });
          }

          const newComponents = [];
          const newRow1 = new ActionRowBuilder();

          newRow1.addComponents(
            new ButtonBuilder()
              .setCustomId('recommend_another_genre')
              .setLabel(`別の${genre}ゲームをおすすめ`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲'),
          );

          if (newGameData.url && newGameData.url.includes('store.steampowered.com')) {
            newEmbed.setURL(newGameData.url);
            newRow1.addComponents(
              new ButtonBuilder()
                .setLabel('Steamストアで見る')
                .setStyle(ButtonStyle.Link)
                .setURL(newGameData.url)
                .setEmoji('🛒'),
            );
          }

          const newRow2 = new ActionRowBuilder();
          newRow2.addComponents(
            new ButtonBuilder()
              .setCustomId('rate_game_good')
              .setLabel('👍 いいね')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('rate_game_bad')
              .setLabel('👎 よくない')
              .setStyle(ButtonStyle.Danger),
          );

          newComponents.push(newRow1, newRow2);

          await i.editReply({ embeds: [newEmbed], components: newComponents });
        }
      } catch (error) {
        logger.error('Error getting new genre game', error);
      }
    });

    logger.info('Personalized genre game recommendation sent', {
      gameName: gameData.name,
      genre: genre,
      userId,
    });

  } catch (error) {
    logger.error('Error in steam genre command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'ジャンル検索中にエラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
