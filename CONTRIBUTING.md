# Contributing to Steam Game Suggester Bot

## セットアップ

1. リポジトリをフォーク
2. ローカルにクローン
3. 依存関係をインストール: `npm install`
4. `.env.example`を`.env`にコピーして、必要なAPIキーを設定

## APIキーの取得

### Discord Bot Token
1. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーション作成
2. Bot セクションでトークンを生成

### Steam API Key
1. [Steam Web API](https://steamcommunity.com/dev/apikey)で取得
2. Steamアカウントが必要

### RAWG API Key
1. [RAWG.io](https://rawg.io/apidocs)でアカウント作成
2. 無料プラン: 月20,000リクエストまで

### IsThereAnyDeal API Key
1. [ITAD API](https://isthereanydeal.com/api/)でアカウント作成
2. 完全無料

## 開発ガイドライン

- ESLintルールに従う: `npm run lint`
- テストを実行: `npm test`
- コミットメッセージは日本語可

## プルリクエスト

1. 機能ごとにブランチを作成
2. テストが通ることを確認
3. プルリクエストを作成