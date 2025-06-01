const itadApi = require('../../services/itadApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamSale(interaction) {
  await interaction.deferReply();

  try {
    logger.info('Getting sale information', { userId: interaction.user.id });

    const topDeals = await itadApi.getTopDeals(50);

    if (!topDeals || topDeals.length === 0) {
      const noDealsEmbed = new EmbedBuilder()
        .setTitle('セール情報')
        .setDescription('現在、大きな割引のあるゲームが見つかりませんでした。')
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noDealsEmbed] });
      return;
    }

    const dealsToShow = topDeals.slice(0, 5);
    const embeds = [];

    for (const deal of dealsToShow) {
      const formattedDeal = itadApi.formatDealForEmbed(deal);
      
      const embed = new EmbedBuilder()
        .setTitle(formattedDeal.title)
        .setColor(EMBED_COLORS.SUCCESS)
        .addFields(
          {
            name: '現在の価格',
            value: formattedDeal.currentPrice,
            inline: true
          },
          {
            name: '元の価格',
            value: formattedDeal.originalPrice || 'N/A',
            inline: true
          },
          {
            name: '割引率',
            value: `-${formattedDeal.discount}`,
            inline: true
          }
        )
        .setFooter({ text: 'Data from IsThereAnyDeal' });

      if (formattedDeal.dealUrl) {
        embed.setURL(formattedDeal.dealUrl);
      }

      embeds.push(embed);
    }

    const mainEmbed = new EmbedBuilder()
      .setTitle('🎮 現在のお得なセール情報')
      .setDescription('現在Steamで大幅割引中のゲームです！')
      .setColor(EMBED_COLORS.INFO)
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_deals')
          .setLabel('他のセールを見る')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

    const response = await interaction.editReply({ 
      embeds: [mainEmbed, ...embeds],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.customId === 'refresh_deals',
      time: 300000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      try {
        const newDeals = await itadApi.getTopDeals(30);
        const randomStart = Math.floor(Math.random() * Math.max(0, newDeals.length - 5));
        const newDealsToShow = newDeals.slice(randomStart, randomStart + 5);

        const newEmbeds = [mainEmbed];

        for (const deal of newDealsToShow) {
          const formattedDeal = itadApi.formatDealForEmbed(deal);
          
          const embed = new EmbedBuilder()
            .setTitle(formattedDeal.title)
            .setColor(EMBED_COLORS.SUCCESS)
            .addFields(
              {
                name: '現在の価格',
                value: formattedDeal.currentPrice,
                inline: true
              },
              {
                name: '元の価格',
                value: formattedDeal.originalPrice || 'N/A',
                inline: true
              },
              {
                name: '割引率',
                value: `-${formattedDeal.discount}`,
                inline: true
              }
            )
            .setFooter({ text: 'Data from IsThereAnyDeal' });

          if (formattedDeal.dealUrl) {
            embed.setURL(formattedDeal.dealUrl);
          }

          newEmbeds.push(embed);
        }

        await i.editReply({ embeds: newEmbeds, components: [row] });
      } catch (error) {
        logger.error('Error refreshing deals', error);
      }
    });

    logger.info('Sale information sent successfully');

  } catch (error) {
    logger.error('Error in steam sale command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'セール情報の取得中にエラーが発生しました。しばらくしてからもう一度お試しください。'
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};