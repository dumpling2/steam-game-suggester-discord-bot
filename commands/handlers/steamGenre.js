const rawgApi = require('../../services/rawgApi');
const steamApi = require('../../services/steamApi');
const GameEmbedBuilder = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('../../config/constants');

module.exports = async function handleSteamGenre(interaction) {
  const genre = interaction.options.getString('ジャンル');
  
  await interaction.deferReply();

  try {
    logger.info('Getting game by genre', { genre, userId: interaction.user.id });

    const randomGame = await rawgApi.getRandomGameByGenre(genre);

    if (!randomGame) {
      const noResultEmbed = new EmbedBuilder()
        .setTitle('ジャンル検索結果')
        .setDescription(`ジャンル「${genre}」のゲームが見つかりませんでした。`)
        .setColor(EMBED_COLORS.WARNING)
        .setTimestamp();

      await interaction.editReply({ embeds: [noResultEmbed] });
      return;
    }

    const formattedGame = rawgApi.formatGameForEmbed(randomGame);

    const embed = new EmbedBuilder()
      .setTitle(formattedGame.name)
      .setDescription(formattedGame.description.substring(0, 300) + (formattedGame.description.length > 300 ? '...' : ''))
      .setColor(EMBED_COLORS.INFO)
      .setImage(formattedGame.headerImage)
      .setTimestamp()
      .setFooter({ text: 'Data from RAWG' });

    if (formattedGame.genres.length > 0) {
      embed.addFields({
        name: 'ジャンル',
        value: formattedGame.genres.join(', '),
        inline: true
      });
    }

    if (formattedGame.rating) {
      embed.addFields({
        name: '評価',
        value: formattedGame.rating,
        inline: true
      });
    }

    if (formattedGame.metacritic) {
      embed.addFields({
        name: 'メタスコア',
        value: formattedGame.metacritic,
        inline: true
      });
    }

    if (formattedGame.releaseDate) {
      embed.addFields({
        name: 'リリース日',
        value: formattedGame.releaseDate,
        inline: true
      });
    }

    if (formattedGame.platforms.length > 0) {
      embed.addFields({
        name: 'プラットフォーム',
        value: formattedGame.platforms.slice(0, 3).join(', '),
        inline: true
      });
    }

    const steamInfo = await rawgApi.searchSteamGame(formattedGame.name);
    let steamUrl = null;
    let steamButton = null;

    if (steamInfo && steamInfo.appId) {
      steamUrl = `https://store.steampowered.com/app/${steamInfo.appId}`;
      embed.setURL(steamUrl);

      const steamDetails = await steamApi.getAppDetails(steamInfo.appId);
      if (steamDetails) {
        const steamFormatted = steamApi.formatGameDetails(steamDetails);
        if (steamFormatted.price) {
          embed.addFields({
            name: 'Steam価格',
            value: steamFormatted.price,
            inline: true
          });
        }
      }

      steamButton = new ButtonBuilder()
        .setLabel('Steamストアで見る')
        .setStyle(ButtonStyle.Link)
        .setURL(steamUrl)
        .setEmoji('🛒');
    }

    const components = [];
    const row = new ActionRowBuilder();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('recommend_another_genre')
        .setLabel(`別の${genre}ゲームをおすすめ`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲')
    );

    if (steamButton) {
      row.addComponents(steamButton);
    }

    components.push(row);

    const response = await interaction.editReply({ 
      embeds: [embed], 
      components: components 
    });

    const collector = response.createMessageComponentCollector({ 
      filter: i => i.customId === 'recommend_another_genre',
      time: 300000
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'このボタンは他の人が使用することはできません。', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      try {
        const newGame = await rawgApi.getRandomGameByGenre(genre);
        
        if (newGame) {
          const newFormattedGame = rawgApi.formatGameForEmbed(newGame);
          
          const newEmbed = new EmbedBuilder()
            .setTitle(newFormattedGame.name)
            .setDescription(newFormattedGame.description.substring(0, 300) + (newFormattedGame.description.length > 300 ? '...' : ''))
            .setColor(EMBED_COLORS.INFO)
            .setImage(newFormattedGame.headerImage)
            .setTimestamp()
            .setFooter({ text: 'Data from RAWG' });

          if (newFormattedGame.genres.length > 0) {
            newEmbed.addFields({
              name: 'ジャンル',
              value: newFormattedGame.genres.join(', '),
              inline: true
            });
          }

          if (newFormattedGame.rating) {
            newEmbed.addFields({
              name: '評価',
              value: newFormattedGame.rating,
              inline: true
            });
          }

          if (newFormattedGame.releaseDate) {
            newEmbed.addFields({
              name: 'リリース日',
              value: newFormattedGame.releaseDate,
              inline: true
            });
          }

          const newSteamInfo = await rawgApi.searchSteamGame(newFormattedGame.name);
          const newRow = new ActionRowBuilder();

          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId('recommend_another_genre')
              .setLabel(`別の${genre}ゲームをおすすめ`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🎲')
          );

          if (newSteamInfo && newSteamInfo.appId) {
            const newSteamUrl = `https://store.steampowered.com/app/${newSteamInfo.appId}`;
            newEmbed.setURL(newSteamUrl);
            
            newRow.addComponents(
              new ButtonBuilder()
                .setLabel('Steamストアで見る')
                .setStyle(ButtonStyle.Link)
                .setURL(newSteamUrl)
                .setEmoji('🛒')
            );
          }

          await i.editReply({ embeds: [newEmbed], components: [newRow] });
        }
      } catch (error) {
        logger.error('Error getting new genre game', error);
      }
    });

    logger.info('Genre game recommendation sent', { 
      gameName: formattedGame.name,
      genre: genre
    });

  } catch (error) {
    logger.error('Error in steam genre command', error);
    
    const errorEmbed = GameEmbedBuilder.createErrorEmbed(
      'ジャンル検索中にエラーが発生しました。しばらくしてからもう一度お試しください。'
    );
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
};