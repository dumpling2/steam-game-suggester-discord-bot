const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function handleSteamInfo(interaction) {
  const gameName = interaction.options.getString('ゲーム名');

  await interaction.deferReply();

  try {
    logger.info('Searching for game', { gameName, userId: interaction.user.id });

    const gameApp = await steamApi.searchGameByName(gameName);

    if (!gameApp) {
      const noResultEmbed = GameEmbedBuilder.createNoResultEmbed(gameName);
      await interaction.editReply({ embeds: [noResultEmbed] });
      return;
    }

    const gameDetails = await steamApi.getAppDetails(gameApp.appid);

    if (!gameDetails) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        'ゲームの詳細情報を取得できませんでした。しばらくしてからもう一度お試しください。',
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const formattedGame = steamApi.formatGameDetails(gameDetails);
    const gameEmbed = GameEmbedBuilder.createGameEmbed(formattedGame);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Steamストアで見る')
          .setStyle(ButtonStyle.Link)
          .setURL(formattedGame.storeUrl)
          .setEmoji('🛒'),
      );

    await interaction.editReply({
      embeds: [gameEmbed],
      components: [row],
    });

    logger.info('Game info sent successfully', {
      gameName: formattedGame.name,
      appId: formattedGame.appId,
    });

  } catch (error) {
    logger.error('Error in steam info command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'エラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
