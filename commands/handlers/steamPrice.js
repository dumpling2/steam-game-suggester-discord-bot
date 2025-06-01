const itadApi = require('../../services/itadApi');
const rawgApi = require('../../services/rawgApi');
const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamPrice(interaction, maxPrice) {
  const price = maxPrice ?? interaction.options.getInteger('最大価格');
  const isFree = price === 0;

  await interaction.deferReply();

  try {
    logger.info('Getting games by price', { maxPrice: price, isFree, userId: interaction.user.id });

    let games = [];

    // ITAD APIを試す
    try {
      games = await itadApi.getGamesByPriceRange(price / 100, isFree); // Convert yen to dollars approximation
    } catch (error) {
      logger.warn('ITAD API failed, using fallback method', error);
    }

    // ITAD APIで結果が得られない場合は、無料ゲームの場合のみSteam APIを使用
    if ((!games || games.length === 0) && isFree) {
      logger.info('Using Steam API for free games fallback');
      const randomApp = await steamApi.getRandomGame();
      const gameDetails = await steamApi.getAppDetails(randomApp.appid);

      if (gameDetails && gameDetails.is_free) {
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
    }

    if (!games || games.length === 0) {
      const priceText = isFree ? '無料' : `¥${price}以下`;
      const noResultEmbed = new EmbedBuilder()
        .setTitle('価格検索結果')
        .setDescription(`${priceText}のゲームが見つかりませんでした。\n\n${isFree ? 'Steam APIで無料ゲームの検索を試みましたが、見つかりませんでした。' : 'IsThereAnyDeal APIが利用できません。'}`)
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noResultEmbed] });
      return;
    }

    const randomIndex = Math.floor(Math.random() * Math.min(games.length, 20));
    const selectedGame = games[randomIndex];
    const formattedDeal = itadApi.formatDealForEmbed(selectedGame);

    const embed = new EmbedBuilder()
      .setTitle(formattedDeal.title)
      .setColor(isFree ? EMBED_COLORS.SUCCESS : EMBED_COLORS.INFO)
      .setTimestamp()
      .setFooter({ text: 'Data from IsThereAnyDeal' });

    if (formattedDeal.dealUrl) {
      embed.setURL(formattedDeal.dealUrl);
    }

    embed.addFields({
      name: '現在の価格',
      value: formattedDeal.currentPrice,
      inline: true,
    });

    if (formattedDeal.originalPrice && formattedDeal.discount) {
      embed.addFields(
        {
          name: '元の価格',
          value: formattedDeal.originalPrice,
          inline: true,
        },
        {
          name: '割引率',
          value: `-${formattedDeal.discount}`,
          inline: true,
        },
      );
    }

    const rawgSearch = await rawgApi.searchSteamGame(formattedDeal.title);
    if (rawgSearch && rawgSearch.rawgData) {
      const rawgFormatted = rawgApi.formatGameForEmbed(rawgSearch.rawgData);

      if (rawgFormatted.headerImage) {
        embed.setImage(rawgFormatted.headerImage);
      }

      if (rawgFormatted.genres.length > 0) {
        embed.addFields({
          name: 'ジャンル',
          value: rawgFormatted.genres.join(', '),
          inline: true,
        });
      }

      if (rawgFormatted.rating) {
        embed.addFields({
          name: '評価',
          value: rawgFormatted.rating,
          inline: true,
        });
      }
    }

    const priceText = isFree ? '無料' : `¥${price}以下`;
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('recommend_another_price')
          .setLabel(`別の${priceText}ゲームをおすすめ`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎲'),
      );

    if (formattedDeal.dealUrl) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('ストアで見る')
          .setStyle(ButtonStyle.Link)
          .setURL(formattedDeal.dealUrl)
          .setEmoji('🛒'),
      );
    }

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.customId === 'recommend_another_price',
      time: 300000,
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      try {
        const newRandomIndex = Math.floor(Math.random() * Math.min(games.length, 20));
        const newSelectedGame = games[newRandomIndex];
        const newFormattedDeal = itadApi.formatDealForEmbed(newSelectedGame);

        const newEmbed = new EmbedBuilder()
          .setTitle(newFormattedDeal.title)
          .setColor(isFree ? EMBED_COLORS.SUCCESS : EMBED_COLORS.INFO)
          .setTimestamp()
          .setFooter({ text: 'Data from IsThereAnyDeal' });

        if (newFormattedDeal.dealUrl) {
          newEmbed.setURL(newFormattedDeal.dealUrl);
        }

        newEmbed.addFields({
          name: '現在の価格',
          value: newFormattedDeal.currentPrice,
          inline: true,
        });

        if (newFormattedDeal.originalPrice && newFormattedDeal.discount) {
          newEmbed.addFields(
            {
              name: '元の価格',
              value: newFormattedDeal.originalPrice,
              inline: true,
            },
            {
              name: '割引率',
              value: `-${newFormattedDeal.discount}`,
              inline: true,
            },
          );
        }

        const newRawgSearch = await rawgApi.searchSteamGame(newFormattedDeal.title);
        if (newRawgSearch && newRawgSearch.rawgData) {
          const newRawgFormatted = rawgApi.formatGameForEmbed(newRawgSearch.rawgData);

          if (newRawgFormatted.headerImage) {
            newEmbed.setImage(newRawgFormatted.headerImage);
          }

          if (newRawgFormatted.genres.length > 0) {
            newEmbed.addFields({
              name: 'ジャンル',
              value: newRawgFormatted.genres.join(', '),
              inline: true,
            });
          }
        }

        const newRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('recommend_another_price')
              .setLabel(`別の${priceText}ゲームをおすすめ`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲'),
          );

        if (newFormattedDeal.dealUrl) {
          newRow.addComponents(
            new ButtonBuilder()
              .setLabel('ストアで見る')
              .setStyle(ButtonStyle.Link)
              .setURL(newFormattedDeal.dealUrl)
              .setEmoji('🛒'),
          );
        }

        await i.editReply({ embeds: [newEmbed], components: [newRow] });
      } catch (error) {
        logger.error('Error getting new price-based game', error);
      }
    });

    logger.info('Price-based game recommendation sent', {
      gameName: formattedDeal.title,
      price: formattedDeal.currentPrice,
    });

  } catch (error) {
    logger.error('Error in steam price command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      '価格検索中にエラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
