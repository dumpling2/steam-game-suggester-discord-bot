const rawgApi = require('../../services/rawgApi');
const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamTopRated(interaction) {
  await interaction.deferReply();

  try {
    logger.info('Getting top rated games', { userId: interaction.user.id });

    const topRatedGames = await rawgApi.getTopRatedGames(4.3);

    if (!topRatedGames || topRatedGames.length === 0) {
      const noResultEmbed = new EmbedBuilder()
        .setTitle('高評価ゲーム')
        .setDescription('現在、高評価のゲームが見つかりませんでした。')
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noResultEmbed] });
      return;
    }

    const randomIndex = Math.floor(Math.random() * topRatedGames.length);
    const selectedGame = topRatedGames[randomIndex];
    const formattedGame = rawgApi.formatGameForEmbed(selectedGame);

    const embed = new EmbedBuilder()
      .setTitle(`⭐ ${formattedGame.name}`)
      .setDescription(formattedGame.description.substring(0, 300) + (formattedGame.description.length > 300 ? '...' : ''))
      .setColor(EMBED_COLORS.SUCCESS)
      .setImage(formattedGame.headerImage)
      .setTimestamp()
      .setFooter({ text: 'Data from RAWG - 高評価ゲーム' });

    if (formattedGame.genres.length > 0) {
      embed.addFields({
        name: 'ジャンル',
        value: formattedGame.genres.join(', '),
        inline: true,
      });
    }

    embed.addFields({
      name: '評価',
      value: `⭐ ${formattedGame.rating}`,
      inline: true,
    });

    if (formattedGame.metacritic) {
      embed.addFields({
        name: 'メタスコア',
        value: formattedGame.metacritic,
        inline: true,
      });
    }

    if (formattedGame.releaseDate) {
      embed.addFields({
        name: 'リリース日',
        value: formattedGame.releaseDate,
        inline: true,
      });
    }

    if (selectedGame.ratings_count) {
      embed.addFields({
        name: 'レビュー数',
        value: `${selectedGame.ratings_count.toLocaleString()} 件`,
        inline: true,
      });
    }

    const steamInfo = await rawgApi.searchSteamGame(formattedGame.name);
    let steamButton = null;

    if (steamInfo && steamInfo.appId) {
      const steamUrl = `https://store.steampowered.com/app/${steamInfo.appId}`;
      embed.setURL(steamUrl);

      const steamDetails = await steamApi.getAppDetails(steamInfo.appId);
      if (steamDetails) {
        const steamFormatted = steamApi.formatGameDetails(steamDetails);
        if (steamFormatted.price) {
          embed.addFields({
            name: 'Steam価格',
            value: steamFormatted.price,
            inline: true,
          });
        }
      }

      steamButton = new ButtonBuilder()
        .setLabel('Steamストアで見る')
        .setStyle(ButtonStyle.Link)
        .setURL(steamUrl)
        .setEmoji('🛒');
    }

    const row = new ActionRowBuilder();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('recommend_another_top')
        .setLabel('別の高評価ゲームをおすすめ')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⭐'),
    );

    if (steamButton) {
      row.addComponents(steamButton);
    }

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.customId === 'recommend_another_top',
      time: 300000,
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      try {
        const newRandomIndex = Math.floor(Math.random() * topRatedGames.length);
        const newSelectedGame = topRatedGames[newRandomIndex];
        const newFormattedGame = rawgApi.formatGameForEmbed(newSelectedGame);

        const newEmbed = new EmbedBuilder()
          .setTitle(`⭐ ${newFormattedGame.name}`)
          .setDescription(newFormattedGame.description.substring(0, 300) + (newFormattedGame.description.length > 300 ? '...' : ''))
          .setColor(EMBED_COLORS.SUCCESS)
          .setImage(newFormattedGame.headerImage)
          .setTimestamp()
          .setFooter({ text: 'Data from RAWG - 高評価ゲーム' });

        if (newFormattedGame.genres.length > 0) {
          newEmbed.addFields({
            name: 'ジャンル',
            value: newFormattedGame.genres.join(', '),
            inline: true,
          });
        }

        newEmbed.addFields({
          name: '評価',
          value: `⭐ ${newFormattedGame.rating}`,
          inline: true,
        });

        if (newFormattedGame.metacritic) {
          newEmbed.addFields({
            name: 'メタスコア',
            value: newFormattedGame.metacritic,
            inline: true,
          });
        }

        if (newFormattedGame.releaseDate) {
          newEmbed.addFields({
            name: 'リリース日',
            value: newFormattedGame.releaseDate,
            inline: true,
          });
        }

        if (newSelectedGame.ratings_count) {
          newEmbed.addFields({
            name: 'レビュー数',
            value: `${newSelectedGame.ratings_count.toLocaleString()} 件`,
            inline: true,
          });
        }

        const newSteamInfo = await rawgApi.searchSteamGame(newFormattedGame.name);
        const newRow = new ActionRowBuilder();

        newRow.addComponents(
          new ButtonBuilder()
            .setCustomId('recommend_another_top')
            .setLabel('別の高評価ゲームをおすすめ')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⭐'),
        );

        if (newSteamInfo && newSteamInfo.appId) {
          const newSteamUrl = `https://store.steampowered.com/app/${newSteamInfo.appId}`;
          newEmbed.setURL(newSteamUrl);

          const steamDetails = await steamApi.getAppDetails(newSteamInfo.appId);
          if (steamDetails) {
            const steamFormatted = steamApi.formatGameDetails(steamDetails);
            if (steamFormatted.price) {
              const priceField = newEmbed.data.fields.find(f => f.name === 'Steam価格');
              if (priceField) {
                priceField.value = steamFormatted.price;
              } else {
                newEmbed.addFields({
                  name: 'Steam価格',
                  value: steamFormatted.price,
                  inline: true,
                });
              }
            }
          }

          newRow.addComponents(
            new ButtonBuilder()
              .setLabel('Steamストアで見る')
              .setStyle(ButtonStyle.Link)
              .setURL(newSteamUrl)
              .setEmoji('🛒'),
          );
        }

        await i.editReply({ embeds: [newEmbed], components: [newRow] });
      } catch (error) {
        logger.error('Error getting new top rated game', error);
      }
    });

    logger.info('Top rated game recommendation sent', {
      gameName: formattedGame.name,
      rating: formattedGame.rating,
    });

  } catch (error) {
    logger.error('Error in steam top rated command', error);

    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      '高評価ゲームの取得中にエラーが発生しました。しばらくしてからもう一度お試しください。',
    );

    await interaction.editReply({ embeds: [errorEmbed] });
  }
};
