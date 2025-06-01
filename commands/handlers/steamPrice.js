const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const recommendationService = require('../../services/recommendationService');
const logger = require('../../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

// Helper function to find free games (now prioritizes popular games)
async function findFreeGame() {
  logger.info('Steam APIで人気の無料ゲームを検索中...');

  try {
    // まず人気の無料ゲームを探す
    const popularFreeGames = await steamApi.getPopularGames({
      count: 1,
      freeOnly: true,
      minReviews: 50, // 最低50レビュー
    });

    if (popularFreeGames.length > 0) {
      return popularFreeGames[0];
    }
  } catch (error) {
    logger.warn('人気無料ゲーム検索に失敗、フォールバック検索を実行', error);
  }

  // フォールバック：従来の方法
  const batchSize = 10;
  const maxBatches = 5;

  for (let batch = 0; batch < maxBatches; batch++) {
    const randomApps = await steamApi.getMultipleRandomGames(batchSize);
    const appIds = randomApps.map(app => app.appid);
    const gamesDetails = await steamApi.getAppDetailsMultiple(appIds);

    for (const gameDetails of gamesDetails) {
      if (gameDetails && gameDetails.is_free && gameDetails.type === 'game') {
        return steamApi.formatGameDetails(gameDetails);
      }
    }
  }

  return null;
}

// Helper function to find games by price (now prioritizes popular games)
async function findGameByPrice(minPrice, maxPrice) {
  logger.info('Steam APIで価格範囲内の人気ゲームを検索中...', { minPrice, maxPrice });

  try {
    // まず人気ゲームを探す
    const popularGames = await steamApi.getPopularGames({
      count: 5,
      minPrice,
      maxPrice,
      minReviews: 100, // 最低100レビュー
    });

    if (popularGames.length > 0) {
      // currentPriceを設定
      return popularGames.map(game => {
        if (game.price !== 'Free' && game.originalPrice) {
          // 価格情報があれば設定
          const priceMatch = game.price.match(/[\d,]+/);
          if (priceMatch) {
            game.currentPrice = parseInt(priceMatch[0].replace(',', ''));
          }
        }
        return game;
      });
    }
  } catch (error) {
    logger.warn('人気ゲーム検索に失敗、フォールバック検索を実行', error);
  }

  // フォールバック：従来の方法
  const foundGames = [];
  const targetGames = 5;
  const batchSize = 15;
  const maxBatches = 5;

  for (let batch = 0; batch < maxBatches && foundGames.length < targetGames; batch++) {
    const randomApps = await steamApi.getMultipleRandomGames(batchSize);
    const appIds = randomApps.map(app => app.appid);
    const gamesDetails = await steamApi.getAppDetailsMultiple(appIds);

    for (const gameDetails of gamesDetails) {
      if (gameDetails && gameDetails.type === 'game' && gameDetails.price_overview) {
        const priceInYen = gameDetails.price_overview.final / 100;

        if (priceInYen >= minPrice && priceInYen <= maxPrice) {
          const formattedGame = steamApi.formatGameDetails(gameDetails);
          formattedGame.currentPrice = priceInYen;
          foundGames.push(formattedGame);
          logger.info('価格範囲内のゲームを発見', {
            name: formattedGame.name,
            price: priceInYen,
          });

          if (foundGames.length >= targetGames) {
            break;
          }
        }
      }
    }
  }

  return foundGames;
}

module.exports = async function handleSteamPrice(interaction, overrideMaxPrice) {
  const minPrice = interaction.options?.getInteger('最小価格') ?? 0;
  const maxPrice = overrideMaxPrice ?? interaction.options?.getInteger('最大価格');
  const isFree = maxPrice === 0;

  await interaction.deferReply();

  try {
    logger.info('Getting games by price', { minPrice, maxPrice, isFree, userId: interaction.user.id });

    // ITAD APIは一時的に無効化（APIエンドポイントの問題のため）
    logger.info('ITAD API is temporarily disabled, using Steam-based alternatives');

    // 無料ゲーム検索
    if (isFree) {
      const userId = interaction.user.id;
      const username = interaction.user.username;

      // 進行状況メッセージを送信
      await interaction.editReply({
        content: '🔍 無料ゲームを検索中... しばらくお待ちください。',
      });

      const formattedGame = await findFreeGame();

      if (formattedGame) {
        // ユーザーアクションを記録
        try {
          await recommendationService.recordUserAction(
            userId,
            username,
            formattedGame,
            'viewed',
          );
        } catch (error) {
          logger.error('Failed to record user action', error);
        }

        const embed = new EmbedBuilder()
          .setTitle(formattedGame.name)
          .setURL(formattedGame.url)
          .setDescription(formattedGame.description || 'ゲームの説明がありません。')
          .setColor(EMBED_COLORS.SUCCESS)
          .setImage(formattedGame.image)
          .setTimestamp()
          .setFooter({ text: 'Data from Steam' });

        if (formattedGame.genres && formattedGame.genres.length > 0) {
          embed.addFields({
            name: 'ジャンル',
            value: formattedGame.genres.join(', '),
            inline: true,
          });
        }

        embed.addFields({
          name: '価格',
          value: '無料',
          inline: true,
        });

        if (formattedGame.releaseDate) {
          embed.addFields({
            name: 'リリース日',
            value: formattedGame.releaseDate,
            inline: true,
          });
        }

        // ボタンを追加
        const row1 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('free_game_another')
              .setLabel('別の無料ゲームをおすすめ')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲'),
            new ButtonBuilder()
              .setLabel('Steamストアで見る')
              .setStyle(ButtonStyle.Link)
              .setURL(formattedGame.url)
              .setEmoji('🛒'),
          );

        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('rate_game_good')
              .setLabel('👍 いいね')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('rate_game_bad')
              .setLabel('👎 よくない')
              .setStyle(ButtonStyle.Danger),
          );

        const response = await interaction.editReply({
          content: '', // メッセージをクリア
          embeds: [embed],
          components: [row1, row2],
        });

        // ボタンのコレクター
        const collector = response.createMessageComponentCollector({
          filter: i => ['free_game_another', 'rate_game_good', 'rate_game_bad'].includes(i.customId),
          time: 300000,
        });

        let currentGame = formattedGame;

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
            return;
          }

          // 評価ボタンの処理
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

          // 新しい無料ゲームを探す
          await i.deferUpdate();

          const newGame = await findFreeGame();

          if (newGame) {
            currentGame = newGame;

            // 新しいゲームのアクションを記録
            try {
              await recommendationService.recordUserAction(
                userId,
                username,
                newGame,
                'viewed',
              );
            } catch (error) {
              logger.error('Failed to record user action', error);
            }

            const newEmbed = new EmbedBuilder()
              .setTitle(newGame.name)
              .setURL(newGame.url)
              .setDescription(newGame.description || 'ゲームの説明がありません。')
              .setColor(EMBED_COLORS.SUCCESS)
              .setImage(newGame.image)
              .setTimestamp()
              .setFooter({ text: 'Data from Steam' });

            if (newGame.genres && newGame.genres.length > 0) {
              newEmbed.addFields({
                name: 'ジャンル',
                value: newGame.genres.join(', '),
                inline: true,
              });
            }

            newEmbed.addFields({
              name: '価格',
              value: '無料',
              inline: true,
            });

            if (newGame.releaseDate) {
              newEmbed.addFields({
                name: 'リリース日',
                value: newGame.releaseDate,
                inline: true,
              });
            }

            const newRow1 = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('free_game_another')
                  .setLabel('別の無料ゲームをおすすめ')
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji('🎲'),
                new ButtonBuilder()
                  .setLabel('Steamストアで見る')
                  .setStyle(ButtonStyle.Link)
                  .setURL(newGame.url)
                  .setEmoji('🛒'),
              );

            await i.editReply({
              embeds: [newEmbed],
              components: [newRow1, row2],
            });
          } else {
            await i.editReply({
              content: '⚠️ 新しい無料ゲームが見つかりませんでした。しばらくしてからもう一度お試しください。',
              embeds: [],
              components: [],
            });
          }
        });

        return;
      }
    }

    // 価格範囲検索
    if (!isFree && maxPrice > 0) {
      const userId = interaction.user.id;
      const username = interaction.user.username;

      // 進行状況メッセージを送信
      const priceRangeText = minPrice > 0
        ? `¥${minPrice}〜¥${maxPrice}`
        : `¥${maxPrice}以下`;
      await interaction.editReply({
        content: `🔍 ${priceRangeText}のゲームを検索中... しばらくお待ちください。`,
      });

      const gamesInPriceRange = await findGameByPrice(minPrice, maxPrice);

      if (gamesInPriceRange.length > 0) {
        // 最初のゲームを表示
        let currentIndex = 0;
        const currentGame = gamesInPriceRange[currentIndex];

        // ユーザーアクションを記録
        try {
          await recommendationService.recordUserAction(
            userId,
            username,
            currentGame,
            'viewed',
          );
        } catch (error) {
          logger.error('Failed to record user action', error);
        }

        const embed = new EmbedBuilder()
          .setTitle(currentGame.name)
          .setURL(currentGame.url)
          .setDescription(currentGame.description || 'ゲームの説明がありません。')
          .setColor(EMBED_COLORS.SUCCESS)
          .setImage(currentGame.image)
          .setTimestamp()
          .setFooter({ text: `Data from Steam | ${currentIndex + 1}/${gamesInPriceRange.length}件` });

        if (currentGame.genres && currentGame.genres.length > 0) {
          embed.addFields({
            name: 'ジャンル',
            value: currentGame.genres.join(', '),
            inline: true,
          });
        }

        embed.addFields({
          name: '価格',
          value: `¥${Math.floor(currentGame.currentPrice)}`,
          inline: true,
        });

        if (currentGame.discount && currentGame.discount > 0) {
          embed.addFields({
            name: '割引率',
            value: `${currentGame.discount}% OFF`,
            inline: true,
          });
        }

        if (currentGame.releaseDate) {
          embed.addFields({
            name: 'リリース日',
            value: currentGame.releaseDate,
            inline: true,
          });
        }

        // ボタンを追加
        const buttons = [];

        if (gamesInPriceRange.length > 1) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId('price_prev')
              .setLabel('前のゲーム')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('price_next')
              .setLabel('次のゲーム')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('➡️')
              .setDisabled(currentIndex >= gamesInPriceRange.length - 1),
          );
        }

        buttons.push(
          new ButtonBuilder()
            .setLabel('Steamストアで見る')
            .setStyle(ButtonStyle.Link)
            .setURL(currentGame.url)
            .setEmoji('🛒'),
        );

        const row1 = new ActionRowBuilder().addComponents(buttons);

        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('rate_game_good')
              .setLabel('👍 いいね')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('rate_game_bad')
              .setLabel('👎 よくない')
              .setStyle(ButtonStyle.Danger),
          );

        const response = await interaction.editReply({
          content: '', // メッセージをクリア
          embeds: [embed],
          components: [row1, row2],
        });

        // ボタンのコレクター
        const collector = response.createMessageComponentCollector({
          filter: i => ['price_prev', 'price_next', 'rate_game_good', 'rate_game_bad'].includes(i.customId),
          time: 300000,
        });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
            return;
          }

          // 評価ボタンの処理
          if (i.customId === 'rate_game_good' || i.customId === 'rate_game_bad') {
            await i.deferReply({ ephemeral: true });

            const rating = i.customId === 'rate_game_good' ? 5 : 1;

            try {
              await recommendationService.recordUserAction(
                userId,
                username,
                gamesInPriceRange[currentIndex],
                'rated',
                rating,
              );

              await i.editReply({
                content: `✅ ${gamesInPriceRange[currentIndex].name}を${rating === 5 ? '高評価' : '低評価'}として記録しました。今後の推薦に反映されます。`,
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

          // ナビゲーションボタンの処理
          await i.deferUpdate();

          if (i.customId === 'price_prev') {
            currentIndex = Math.max(0, currentIndex - 1);
          } else if (i.customId === 'price_next') {
            currentIndex = Math.min(gamesInPriceRange.length - 1, currentIndex + 1);
          }

          const newGame = gamesInPriceRange[currentIndex];

          // 新しいゲームのアクションを記録
          try {
            await recommendationService.recordUserAction(
              userId,
              username,
              newGame,
              'viewed',
            );
          } catch (error) {
            logger.error('Failed to record user action', error);
          }

          const newEmbed = new EmbedBuilder()
            .setTitle(newGame.name)
            .setURL(newGame.url)
            .setDescription(newGame.description || 'ゲームの説明がありません。')
            .setColor(EMBED_COLORS.SUCCESS)
            .setImage(newGame.image)
            .setTimestamp()
            .setFooter({ text: `Data from Steam | ${currentIndex + 1}/${gamesInPriceRange.length}件` });

          if (newGame.genres && newGame.genres.length > 0) {
            newEmbed.addFields({
              name: 'ジャンル',
              value: newGame.genres.join(', '),
              inline: true,
            });
          }

          newEmbed.addFields({
            name: '価格',
            value: `¥${Math.floor(newGame.currentPrice)}`,
            inline: true,
          });

          if (newGame.discount && newGame.discount > 0) {
            newEmbed.addFields({
              name: '割引率',
              value: `${newGame.discount}% OFF`,
              inline: true,
            });
          }

          if (newGame.releaseDate) {
            newEmbed.addFields({
              name: 'リリース日',
              value: newGame.releaseDate,
              inline: true,
            });
          }

          // ボタンを更新
          const newButtons = [];

          if (gamesInPriceRange.length > 1) {
            newButtons.push(
              new ButtonBuilder()
                .setCustomId('price_prev')
                .setLabel('前のゲーム')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
                .setDisabled(currentIndex === 0),
              new ButtonBuilder()
                .setCustomId('price_next')
                .setLabel('次のゲーム')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➡️')
                .setDisabled(currentIndex >= gamesInPriceRange.length - 1),
            );
          }

          newButtons.push(
            new ButtonBuilder()
              .setLabel('Steamストアで見る')
              .setStyle(ButtonStyle.Link)
              .setURL(newGame.url)
              .setEmoji('🛒'),
          );

          const newRow1 = new ActionRowBuilder().addComponents(newButtons);

          await i.editReply({
            embeds: [newEmbed],
            components: [newRow1, row2],
          });
        });

        return;
      }
    }

    // 結果が見つからない場合のメッセージ
    const priceText = isFree
      ? '無料'
      : minPrice > 0
        ? `¥${minPrice}〜¥${maxPrice}`
        : `¥${maxPrice}以下`;
    const noResultEmbed = new EmbedBuilder()
      .setTitle('価格検索結果')
      .setDescription(
        isFree
          ? '無料ゲームが見つかりませんでした。\n\nSteam APIで無料ゲームを検索しましたが、適切なゲームを見つけることができませんでした。\n\n他のコマンドもお試しください：\n• `/steam おすすめ` - おすすめゲーム\n• `/steam genre` - ジャンル別検索'
          : `${priceText}のゲームが見つかりませんでした。\n\nSteam APIで価格範囲内のゲームを検索しましたが、適切なゲームを見つけることができませんでした。\n\n他のコマンドもお試しください：\n• \`/steam おすすめ\` - おすすめゲーム\n• \`/steam free\` - 無料ゲーム\n• \`/steam genre [ジャンル]\` - ジャンル別検索`,
      )
      .setColor(EMBED_COLORS.WARNING)
      .setTimestamp();

    await interaction.editReply({ embeds: [noResultEmbed] });

  } catch (error) {
    logger.error('Error in steam price command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      '価格検索中にエラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
