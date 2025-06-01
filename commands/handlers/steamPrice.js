const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamPrice(interaction, maxPrice) {
  const price = maxPrice ?? interaction.options.getInteger('最大価格');
  const isFree = price === 0;

  await interaction.deferReply();

  try {
    logger.info('Getting games by price', { maxPrice: price, isFree, userId: interaction.user.id });

    // ITAD APIは一時的に無効化（APIエンドポイントの問題のため）
    logger.info('ITAD API is temporarily disabled, using Steam-based alternatives');

    // 無料ゲーム検索
    if (isFree) {
      logger.info('Steam APIで無料ゲームを検索中...');

      let attempts = 0;
      const maxAttempts = 15;

      while (attempts < maxAttempts) {
        const randomApp = await steamApi.getRandomGame();
        const gameDetails = await steamApi.getAppDetails(randomApp.appid);

        if (gameDetails && gameDetails.is_free && gameDetails.type === 'game') {
          const formattedGame = steamApi.formatGameDetails(gameDetails);
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

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        attempts++;
      }
    }

    // 結果が見つからない場合のメッセージ
    const priceText = isFree ? '無料' : `¥${price}以下`;
    const noResultEmbed = new EmbedBuilder()
      .setTitle('価格検索結果')
      .setDescription(
        isFree
          ? '無料ゲームが見つかりませんでした。\n\nSteam APIで無料ゲームを検索しましたが、適切なゲームを見つけることができませんでした。\n\n他のコマンドもお試しください：\n• `/steam おすすめ` - おすすめゲーム\n• `/steam genre` - ジャンル別検索'
          : `${priceText}のゲーム検索は現在利用できません。\n\n外部価格APIが一時的に利用できないため、有料ゲームの価格範囲検索は無効になっています。\n\n代わりに以下のコマンドをお試しください：\n• \`/steam おすすめ\` - おすすめゲーム\n• \`/steam free\` - 無料ゲーム\n• \`/steam genre [ジャンル]\` - ジャンル別検索`,
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
