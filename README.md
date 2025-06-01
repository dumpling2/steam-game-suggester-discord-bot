# Steam Game Suggester Discord Bot

Steamゲーム情報・おすすめを提供するDiscordボットです。

## 機能

### 実装済み機能
- `/steam info <ゲーム名>` - 特定のゲーム情報を検索
- `/steam おすすめ` - ランダムにゲームをおすすめ
- `/steam random` - ランダムにゲームをおすすめ（英語版）
- `/steam お得な情報` - 現在のセール情報を表示
- `/steam genre <ジャンル>` - ジャンル別におすすめゲームを表示
- `/steam トップ評価` - 高評価（4.3以上）のゲームをおすすめ
- `/steam price <最大価格>` - 価格帯を指定してゲームを検索
- `/steam free` - 無料ゲームをおすすめ

### 特徴
- すべてのコマンドで「別のゲームをおすすめ」ボタン付き
- Steam、RAWG、IsThereAnyDeal APIを統合
- 日本語対応
- リアルタイムの価格・セール情報

## セットアップ

1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
`.env.example`を`.env`にコピーし、必要な値を設定してください。

```bash
cp .env.example .env
```

3. スラッシュコマンドの登録
```bash
node deploy-commands.js
```

4. ボットの起動
```bash
npm run dev
```

## 開発

- `npm run dev` - 開発モードで起動（ファイル変更時に自動再起動）
- `npm test` - テストの実行
- `npm run lint` - コードのリント

## 必要なAPIキー

このボットを動作させるには以下のAPIキーが必要です：

1. **Discord Bot Token** - [Discord Developer Portal](https://discord.com/developers/applications)
2. **Steam API Key** - [Steam Web API](https://steamcommunity.com/dev/apikey)
3. **RAWG API Key** - [RAWG.io](https://rawg.io/apidocs) (無料: 月20,000リクエスト)
4. **IsThereAnyDeal API Key** - [ITAD API](https://isthereanydeal.com/api/) (完全無料)

詳細は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## 貢献

プルリクエストを歓迎します！詳細は[CONTRIBUTING.md](CONTRIBUTING.md)をご覧ください。

## ライセンス

MIT