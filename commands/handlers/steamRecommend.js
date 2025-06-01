const recommendationService = require('../../services/recommendationService');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function handleSteamRecommend(interaction) {
  await interaction.deferReply();

  async function getPersonalizedRecommendation(userId) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        // Try personalized recommendation first
        const personalizedGame = await recommendationService.getPersonalizedRecommendation(userId);

        if (personalizedGame) {
          logger.debug('Personalized game recommended', {
            gameName: personalizedGame.name,
            appId: personalizedGame.appId,
            userId: userId,
          });
          return personalizedGame;
        }

        attempts++;
      } catch (error) {
        logger.error('Error getting personalized recommendation', error);
        attempts++;
      }
    }

    // Fallback to high-rated recommendation if personalized fails
    try {
      const highRatedGame = await recommendationService.getHighRatedRecommendation();
      if (highRatedGame) {
        logger.debug('High-rated game recommended as fallback', {
          gameName: highRatedGame.name,
        });
        return highRatedGame;
      }
    } catch (error) {
      logger.error('Error getting high-rated recommendation', error);
    }

    // Final fallback to random recommendation
    try {
      const randomGame = await recommendationService.getRandomRecommendation();
      if (randomGame) {
        logger.debug('Random game recommended as final fallback', {
          gameName: randomGame.name,
        });
        return randomGame;
      }
    } catch (error) {
      logger.error('Error getting random recommendation', error);
    }

    return null;
  }

  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    logger.info('Getting personalized game recommendation', { userId: userId });

    const formattedGame = await getPersonalizedRecommendation(userId);

    if (!formattedGame) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        'ゲーム情報を取得できませんでした。もう一度お試しください。',
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Record the recommendation action for personalization
    try {
      await recommendationService.recordUserAction(
        userId,
        username,
        formattedGame,
        'recommended',
      );
    } catch (error) {
      logger.error('Failed to record user action', error);
      // Continue even if recording fails
    }

    const gameEmbed = GameEmbedBuilder.createGameEmbed(formattedGame);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('recommend_another')
          .setLabel('別のゲームをおすすめ')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId('rate_game_good')
          .setLabel('👍 いいね')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('rate_game_bad')
          .setLabel('👎 よくない')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setLabel('Steamストアで見る')
          .setStyle(ButtonStyle.Link)
          .setURL(formattedGame.storeUrl)
          .setEmoji('🛒'),
      );

    const response = await interaction.editReply({
      embeds: [gameEmbed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      filter: i => ['recommend_another', 'rate_game_good', 'rate_game_bad'].includes(i.customId),
      time: 300000, // 5 minutes
    });

    let currentGame = formattedGame;

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      // Handle rating buttons
      if (i.customId === 'rate_game_good' || i.customId === 'rate_game_bad') {
        await i.deferReply({ ephemeral: true });

        try {
          const rating = i.customId === 'rate_game_good' ? 5 : 1;
          await recommendationService.recordUserAction(
            userId,
            username,
            currentGame,
            'rated',
            rating,
          );

          const reactionMessage = rating === 5 ?
            `👍 フィードバックありがとうございます！「${currentGame.name}」への評価が記録されました。` :
            `👎 フィードバックありがとうございます！「${currentGame.name}」への評価が記録されました。今後の推薦に反映されます。`;

          await i.editReply({ content: reactionMessage });
          logger.info('User rated game', { userId, gameName: currentGame.name, rating });
        } catch (error) {
          logger.error('Failed to record game rating', error);
          await i.editReply({ content: '評価の記録に失敗しました。' });
        }
        return;
      }

      // Handle recommend another button
      if (i.customId === 'recommend_another') {
        await i.deferUpdate();

        const newGame = await getPersonalizedRecommendation(userId);

        if (newGame) {
          // Update current game reference
          currentGame = newGame;

          // Record the new recommendation action
          try {
            await recommendationService.recordUserAction(
              userId,
              username,
              newGame,
              'recommended',
            );
          } catch (error) {
            logger.error('Failed to record new recommendation action', error);
          }

          const newEmbed = GameEmbedBuilder.createGameEmbed(newGame);
          const newRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('recommend_another')
                .setLabel('別のゲームをおすすめ')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎲'),
              new ButtonBuilder()
                .setCustomId('rate_game_good')
                .setLabel('👍 いいね')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('rate_game_bad')
                .setLabel('👎 よくない')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setLabel('Steamストアで見る')
                .setStyle(ButtonStyle.Link)
                .setURL(newGame.storeUrl)
                .setEmoji('🛒'),
            );

          await i.editReply({ embeds: [newEmbed], components: [newRow] });
          logger.info('New personalized game recommended', { gameName: newGame.name, userId: userId });
        }
      }
    });

    collector.on('end', () => {
      logger.debug('Button collector ended');
    });

    logger.info('Personalized game recommendation sent', {
      gameName: formattedGame.name,
      appId: formattedGame.appId,
      userId: userId,
    });

  } catch (error) {
    logger.error('Error in steam recommend command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'エラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
