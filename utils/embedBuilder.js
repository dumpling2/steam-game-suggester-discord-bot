const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, MAX_DESCRIPTION_LENGTH } = require('../config/constants');

class GameEmbedBuilder {
  static createGameEmbed(gameData) {
    const embed = new EmbedBuilder()
      .setTitle(gameData.name)
      .setURL(gameData.storeUrl)
      .setColor(EMBED_COLORS.INFO)
      .setImage(gameData.headerImage)
      .setTimestamp()
      .setFooter({ text: 'Data from Steam' });

    let description = gameData.description;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      description = description.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
    }
    embed.setDescription(description);

    if (gameData.genres && gameData.genres.length > 0) {
      embed.addFields({
        name: 'ジャンル',
        value: gameData.genres.join(', '),
        inline: true,
      });
    }

    let priceText = gameData.price;
    if (gameData.discount && gameData.discount > 0) {
      priceText = `~~${gameData.originalPrice}~~ → **${gameData.price}** (-${gameData.discount}%)`;
    }
    embed.addFields({
      name: '価格',
      value: priceText,
      inline: true,
    });

    embed.addFields({
      name: 'リリース日',
      value: gameData.releaseDate,
      inline: true,
    });

    if (gameData.developers && gameData.developers.length > 0) {
      embed.addFields({
        name: '開発元',
        value: gameData.developers.join(', '),
        inline: true,
      });
    }

    const platforms = [];
    if (gameData.platforms.windows) {platforms.push('Windows');}
    if (gameData.platforms.mac) {platforms.push('Mac');}
    if (gameData.platforms.linux) {platforms.push('Linux');}

    if (platforms.length > 0) {
      embed.addFields({
        name: 'プラットフォーム',
        value: platforms.join(', '),
        inline: true,
      });
    }

    return embed;
  }

  static createErrorEmbed(message) {
    return new EmbedBuilder()
      .setTitle('エラー')
      .setDescription(message)
      .setColor(EMBED_COLORS.ERROR)
      .setTimestamp();
  }

  static createLoadingEmbed() {
    return new EmbedBuilder()
      .setTitle('読み込み中...')
      .setDescription('ゲーム情報を取得しています。少々お待ちください。')
      .setColor(EMBED_COLORS.WARNING)
      .setTimestamp();
  }

  static createNoResultEmbed(searchTerm) {
    return new EmbedBuilder()
      .setTitle('検索結果なし')
      .setDescription(`「${searchTerm}」に一致するゲームが見つかりませんでした。`)
      .setColor(EMBED_COLORS.WARNING)
      .setTimestamp();
  }
}

module.exports = GameEmbedBuilder;
