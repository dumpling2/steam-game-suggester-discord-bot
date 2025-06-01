const steamApi = require('../../services/steamApi');
const recommendationService = require('../../services/recommendationService');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

// Helper function to find games on sale (now prioritizes popular games)
async function findGamesOnSale() {
  logger.info('Steam APIで人気のセール中ゲームを検索中...');

  try {
    // まず人気のセールゲームを探す
    const popularSaleGames = await steamApi.getPopularGames({
      count: 5,
      onSale: true,
      minReviews: 100, // 最低100レビュー
    });

    if (popularSaleGames.length > 0) {
      // セール情報を設定
      return popularSaleGames.map(game => {
        if (game.discount && game.originalPrice) {
          const originalPriceMatch = game.originalPrice.match(/[\d,]+/);
          const currentPriceMatch = game.price.match(/[\d,]+/);

          if (originalPriceMatch && currentPriceMatch) {
            game.originalPrice = parseInt(originalPriceMatch[0].replace(',', ''));
            game.currentPrice = parseInt(currentPriceMatch[0].replace(',', ''));
            game.discountPercent = game.discount;
          }
        }
        return game;
      }).sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    }
  } catch (error) {
    logger.warn('人気セールゲーム検索に失敗、フォールバック検索を実行', error);
  }

  // フォールバック：従来の方法
  const foundGames = [];
  const targetGames = 5;
  const batchSize = 20;
  const maxBatches = 6;

  for (let batch = 0; batch < maxBatches && foundGames.length < targetGames; batch++) {
    const randomApps = await steamApi.getMultipleRandomGames(batchSize);
    const appIds = randomApps.map(app => app.appid);
    const gamesDetails = await steamApi.getAppDetailsMultiple(appIds);

    for (const gameDetails of gamesDetails) {
      if (gameDetails && gameDetails.type === 'game' && gameDetails.price_overview) {
        if (gameDetails.price_overview.discount_percent > 0) {
          const formattedGame = steamApi.formatGameDetails(gameDetails);
          formattedGame.currentPrice = gameDetails.price_overview.final / 100;
          formattedGame.originalPrice = gameDetails.price_overview.initial / 100;
          formattedGame.discountPercent = gameDetails.price_overview.discount_percent;
          foundGames.push(formattedGame);
          logger.info('セール中のゲームを発見', {
            name: formattedGame.name,
            discount: formattedGame.discountPercent,
          });

          if (foundGames.length >= targetGames) {
            break;
          }
        }
      }
    }
  }

  return foundGames.sort((a, b) => b.discountPercent - a.discountPercent);
}

// Helper function to create sale embed
function createSaleEmbed(game, index, total) {
  const embed = new EmbedBuilder()
    .setTitle(game.name)
    .setURL(game.url)
    .setDescription(game.description || 'ゲームの説明がありません。')
    .setColor(EMBED_COLORS.SUCCESS)
    .setImage(game.image)
    .setTimestamp()
    .setFooter({ text: `Data from Steam | ${index + 1}/${total}件` });

  if (game.genres && game.genres.length > 0) {
    embed.addFields({
      name: 'ジャンル',
      value: game.genres.join(', '),
      inline: true,
    });
  }

  embed.addFields(
    {
      name: '現在の価格',
      value: `¥${Math.floor(game.currentPrice)}`,
      inline: true,
    },
    {
      name: '元の価格',
      value: `~~¥${Math.floor(game.originalPrice)}~~`,
      inline: true,
    },
    {
      name: '割引率',
      value: `**-${game.discountPercent}%**`,
      inline: true,
    },
  );

  if (game.releaseDate) {
    embed.addFields({
      name: 'リリース日',
      value: game.releaseDate,
      inline: true,
    });
  }

  return embed;
}

module.exports = async function handleSteamSale(interaction) {
  await interaction.deferReply();

  try {
    logger.info('Getting sale information', { userId: interaction.user.id });

    // ITAD APIは一時的に無効化されているため、Steam APIを使用
    logger.info('Using Steam API for sale information (ITAD API temporarily disabled)');

    // 進行状況メッセージを送信
    await interaction.editReply({
      content: '🔍 セール中のゲームを検索中... しばらくお待ちください。',
    });

    const gamesOnSale = await findGamesOnSale();

    if (!gamesOnSale || gamesOnSale.length === 0) {
      const noDealsEmbed = new EmbedBuilder()
        .setTitle('セール情報')
        .setDescription('現在、セール中のゲームが見つかりませんでした。\n\nもう一度お試しいただくか、他のコマンドをご利用ください。')
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noDealsEmbed] });
      return;
    }

    // 現在のインデックス
    let currentIndex = 0;
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // 最初のゲームを表示
    const currentGame = gamesOnSale[currentIndex];

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

    const embed = createSaleEmbed(currentGame, currentIndex, gamesOnSale.length);

    // ボタンを作成
    const buttons = [];

    if (gamesOnSale.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('sale_prev')
          .setLabel('前のセール')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('sale_next')
          .setLabel('次のセール')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
          .setDisabled(currentIndex >= gamesOnSale.length - 1),
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId('sale_refresh')
        .setLabel('他のセールを探す')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
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

    const collector = response.createMessageComponentCollector({
      filter: i => ['sale_prev', 'sale_next', 'sale_refresh', 'rate_game_good', 'rate_game_bad'].includes(i.customId),
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
            gamesOnSale[currentIndex],
            'rated',
            rating,
          );

          await i.editReply({
            content: `✅ ${gamesOnSale[currentIndex].name}を${rating === 5 ? '高評価' : '低評価'}として記録しました。今後の推薦に反映されます。`,
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

      // 新しいセールを探す
      if (i.customId === 'sale_refresh') {
        const newGamesOnSale = await findGamesOnSale();

        if (newGamesOnSale.length > 0) {
          // 既存のリストを新しいもので置き換え
          gamesOnSale.length = 0;
          gamesOnSale.push(...newGamesOnSale);
          currentIndex = 0;
        }
      } else if (i.customId === 'sale_prev') {
        currentIndex = Math.max(0, currentIndex - 1);
      } else if (i.customId === 'sale_next') {
        currentIndex = Math.min(gamesOnSale.length - 1, currentIndex + 1);
      }

      const newGame = gamesOnSale[currentIndex];

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

      const newEmbed = createSaleEmbed(newGame, currentIndex, gamesOnSale.length);

      // ボタンを更新
      const newButtons = [];

      if (gamesOnSale.length > 1) {
        newButtons.push(
          new ButtonBuilder()
            .setCustomId('sale_prev')
            .setLabel('前のセール')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(currentIndex === 0),
          new ButtonBuilder()
            .setCustomId('sale_next')
            .setLabel('次のセール')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(currentIndex >= gamesOnSale.length - 1),
        );
      }

      newButtons.push(
        new ButtonBuilder()
          .setCustomId('sale_refresh')
          .setLabel('他のセールを探す')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
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

    logger.info('Sale information sent successfully');

  } catch (error) {
    logger.error('Error in steam sale command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'セール情報の取得中にエラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
