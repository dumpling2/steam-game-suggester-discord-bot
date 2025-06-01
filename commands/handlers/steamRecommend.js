const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function handleSteamRecommend(interaction) {
  await interaction.deferReply();

  async function getRandomGameWithDetails() {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const randomApp = await steamApi.getRandomGame();
        logger.debug('Random game selected', { appName: randomApp.name, appId: randomApp.appid });

        const gameDetails = await steamApi.getAppDetails(randomApp.appid);
        
        if (gameDetails && gameDetails.type === 'game') {
          return steamApi.formatGameDetails(gameDetails);
        }

        attempts++;
      } catch (error) {
        logger.error('Error getting random game details', error);
        attempts++;
      }
    }

    return null;
  }

  try {
    logger.info('Getting random game recommendation', { userId: interaction.user.id });

    const formattedGame = await getRandomGameWithDetails();

    if (!formattedGame) {
      const errorEmbed = GameEmbedBuilder.createErrorEmbed(
        'ゲーム情報を取得できませんでした。もう一度お試しください。'
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
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
          .setLabel('Steamストアで見る')
          .setStyle(ButtonStyle.Link)
          .setURL(formattedGame.storeUrl)
          .setEmoji('🛒')
      );

    const response = await interaction.editReply({ 
      embeds: [gameEmbed], 
      components: [row] 
    });

    const collector = response.createMessageComponentCollector({ 
      filter: i => i.customId === 'recommend_another',
      time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      const newGame = await getRandomGameWithDetails();
      
      if (newGame) {
        const newEmbed = GameEmbedBuilder.createGameEmbed(newGame);
        const newRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('recommend_another')
              .setLabel('別のゲームをおすすめ')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲'),
            new ButtonBuilder()
              .setLabel('Steamストアで見る')
              .setStyle(ButtonStyle.Link)
              .setURL(newGame.storeUrl)
              .setEmoji('🛒')
          );

        await i.editReply({ embeds: [newEmbed], components: [newRow] });
        logger.info('New random game recommended', { gameName: newGame.name });
      }
    });

    collector.on('end', () => {
      logger.debug('Button collector ended');
    });

    logger.info('Random game recommendation sent', { 
      gameName: formattedGame.name, 
      appId: formattedGame.appId 
    });

  } catch (error) {
    logger.error('Error in steam recommend command', error);
    
    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'エラーが発生しました。しばらくしてからもう一度お試しください。'
    );
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
};