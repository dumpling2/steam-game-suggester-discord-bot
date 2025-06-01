const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, MAX_DESCRIPTION_LENGTH } = require('../config/constants');

class GameEmbedBuilder {
  static createGameEmbed(gameData) {
    const embed = new EmbedBuilder()
      .setTitle(gameData.name || 'Unknown Game')
      .setColor(EMBED_COLORS.INFO)
      .setTimestamp();

    // URL設定
    if (gameData.storeUrl || gameData.url) {
      embed.setURL(gameData.storeUrl || gameData.url);
    }

    // 画像設定
    if (gameData.headerImage || gameData.image) {
      embed.setImage(gameData.headerImage || gameData.image);
    }

    // フッター設定
    const footerText = gameData.platform === 'Steam' ? 'Data from Steam' :
      gameData.platform === 'RAWG' ? 'Data from RAWG' :
        'Data from Steam';
    embed.setFooter({ text: footerText });

    // 説明設定
    if (gameData.description) {
      let description = gameData.description;
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        description = description.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
      }
      embed.setDescription(description);
    }

    // ジャンル
    if (gameData.genres && gameData.genres.length > 0) {
      embed.addFields({
        name: 'ジャンル',
        value: gameData.genres.join(', '),
        inline: true,
      });
    }

    // 価格
    if (gameData.price) {
      let priceText = gameData.price;
      if (gameData.discount && gameData.discount > 0) {
        priceText = `~~${gameData.originalPrice}~~ → **${gameData.price}** (-${gameData.discount}%)`;
      }
      embed.addFields({
        name: '価格',
        value: priceText,
        inline: true,
      });
    }

    // 評価（Steam レビュー情報を優先）
    if (gameData.reviewText && gameData.totalReviews > 0) {
      const reviewInfo = `${gameData.reviewText} (${gameData.totalReviews.toLocaleString()}件)`;
      embed.addFields({
        name: 'Steam評価',
        value: reviewInfo,
        inline: true,
      });
    } else if (gameData.rating) {
      embed.addFields({
        name: '評価',
        value: gameData.rating.toString(),
        inline: true,
      });
    }

    // リリース日
    if (gameData.releaseDate) {
      embed.addFields({
        name: 'リリース日',
        value: gameData.releaseDate,
        inline: true,
      });
    }

    // 開発元
    if (gameData.developers && gameData.developers.length > 0) {
      embed.addFields({
        name: '開発元',
        value: gameData.developers.join(', '),
        inline: true,
      });
    }

    // プラットフォーム
    if (gameData.platforms) {
      let platforms = [];

      if (Array.isArray(gameData.platforms)) {
        // プラットフォームが配列の場合
        platforms = gameData.platforms.slice(0, 3); // 最大3つまで表示
      } else if (typeof gameData.platforms === 'object') {
        // プラットフォームがオブジェクトの場合
        if (gameData.platforms.windows) {platforms.push('Windows');}
        if (gameData.platforms.mac) {platforms.push('Mac');}
        if (gameData.platforms.linux) {platforms.push('Linux');}
      }

      if (platforms.length > 0) {
        embed.addFields({
          name: 'プラットフォーム',
          value: platforms.join(', '),
          inline: true,
        });
      }
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
