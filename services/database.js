const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');
const fs = require('fs').promises;

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'bot.db');
    this.db = null;
  }

  async init() {
    try {
      // データディレクトリを作成
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // データベース接続
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('データベース接続エラー:', err);
        } else {
          logger.info('データベースに接続しました');
        }
      });

      // テーブル作成
      await this.createTables();
    } catch (error) {
      logger.error('データベース初期化エラー:', error);
      throw error;
    }
  }

  async createTables() {
    const queries = [
      // ユーザープロファイルテーブル
      `CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // ユーザーの好みのジャンル
      `CREATE TABLE IF NOT EXISTS user_genre_preferences (
        user_id TEXT,
        genre TEXT,
        score REAL DEFAULT 1.0,
        PRIMARY KEY (user_id, genre),
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
      )`,

      // ユーザーのゲーム評価
      `CREATE TABLE IF NOT EXISTS user_game_ratings (
        user_id TEXT,
        game_id INTEGER,
        game_name TEXT,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, game_id),
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
      )`,

      // ユーザーのゲーム履歴
      `CREATE TABLE IF NOT EXISTS user_game_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        game_id INTEGER,
        game_name TEXT,
        action TEXT, -- 'viewed', 'recommended', 'searched'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
      )`,

      // ゲームの特徴（キャッシュ用）
      `CREATE TABLE IF NOT EXISTS game_features (
        game_id INTEGER PRIMARY KEY,
        game_name TEXT,
        genres TEXT, -- JSON配列
        tags TEXT, -- JSON配列
        rating REAL,
        release_year INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const query of queries) {
      await this.run(query);
    }

    // インデックス作成
    await this.run('CREATE INDEX IF NOT EXISTS idx_history_user_id ON user_game_history(user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_history_created_at ON user_game_history(created_at)');
  }

  // Promise化したデータベース操作
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ユーザープロファイル操作
  async createOrUpdateUser(userId, username) {
    const query = `
      INSERT INTO user_profiles (user_id, username)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        updated_at = CURRENT_TIMESTAMP
    `;
    return await this.run(query, [userId, username]);
  }

  async getUserProfile(userId) {
    const query = 'SELECT * FROM user_profiles WHERE user_id = ?';
    return await this.get(query, [userId]);
  }

  // ジャンル好み操作
  async updateGenrePreference(userId, genre, scoreChange) {
    const query = `
      INSERT INTO user_genre_preferences (user_id, genre, score)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, genre) DO UPDATE SET
        score = MIN(MAX(score + ?, 0), 5)
    `;
    return await this.run(query, [userId, genre, scoreChange, scoreChange]);
  }

  async getUserGenrePreferences(userId) {
    const query = `
      SELECT genre, score
      FROM user_genre_preferences
      WHERE user_id = ?
      ORDER BY score DESC
    `;
    return await this.all(query, [userId]);
  }

  // ゲーム評価操作
  async addGameRating(userId, gameId, gameName, rating) {
    const query = `
      INSERT INTO user_game_ratings (user_id, game_id, game_name, rating)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, game_id) DO UPDATE SET
        rating = excluded.rating,
        game_name = excluded.game_name
    `;
    return await this.run(query, [userId, gameId, gameName, rating]);
  }

  async getUserGameRatings(userId, limit = 50) {
    const query = `
      SELECT game_id, game_name, rating, created_at
      FROM user_game_ratings
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await this.all(query, [userId, limit]);
  }

  // 履歴操作
  async addGameHistory(userId, gameId, gameName, action) {
    const query = `
      INSERT INTO user_game_history (user_id, game_id, game_name, action)
      VALUES (?, ?, ?, ?)
    `;
    return await this.run(query, [userId, gameId, gameName, action]);
  }

  async getUserHistory(userId, action = null, limit = 100) {
    let query = `
      SELECT game_id, game_name, action, created_at
      FROM user_game_history
      WHERE user_id = ?
    `;
    const params = [userId];

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await this.all(query, params);
  }

  // ゲーム特徴操作
  async saveGameFeatures(gameId, gameName, genres, tags, rating, releaseYear) {
    const query = `
      INSERT INTO game_features (game_id, game_name, genres, tags, rating, release_year)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id) DO UPDATE SET
        game_name = excluded.game_name,
        genres = excluded.genres,
        tags = excluded.tags,
        rating = excluded.rating,
        release_year = excluded.release_year,
        updated_at = CURRENT_TIMESTAMP
    `;
    return await this.run(query, [
      gameId,
      gameName,
      JSON.stringify(genres || []),
      JSON.stringify(tags || []),
      rating,
      releaseYear,
    ]);
  }

  async getGameFeatures(gameId) {
    const query = 'SELECT * FROM game_features WHERE game_id = ?';
    const row = await this.get(query, [gameId]);
    if (row) {
      row.genres = JSON.parse(row.genres);
      row.tags = JSON.parse(row.tags);
    }
    return row;
  }

  // 推薦用のクエリ
  async getRecommendedGames(userId, limit = 10) {
    // ユーザーの好みのジャンルを取得
    const genrePrefs = await this.getUserGenrePreferences(userId);

    if (genrePrefs.length === 0) {
      // 好みがない場合は高評価ゲームを返す
      const query = `
        SELECT DISTINCT gf.*
        FROM game_features gf
        WHERE gf.rating >= 4.0
        ORDER BY gf.rating DESC
        LIMIT ?
      `;
      const rows = await this.all(query, [limit]);
      return rows.map(row => ({
        ...row,
        genres: JSON.parse(row.genres),
        tags: JSON.parse(row.tags),
      }));
    }

    // ユーザーが既に評価したゲームを除外して推薦
    const topGenres = genrePrefs.slice(0, 3).map(p => p.genre);
    const query = `
      SELECT DISTINCT gf.*
      FROM game_features gf
      WHERE gf.game_id NOT IN (
        SELECT game_id FROM user_game_ratings WHERE user_id = ?
      )
      AND (
        ${topGenres.map(() => 'gf.genres LIKE ?').join(' OR ')}
      )
      ORDER BY gf.rating DESC
      LIMIT ?
    `;

    const params = [userId, ...topGenres.map(g => `%"${g}"%`), limit];
    const rows = await this.all(query, params);

    return rows.map(row => ({
      ...row,
      genres: JSON.parse(row.genres),
      tags: JSON.parse(row.tags),
    }));
  }

  // 類似ゲーム検索
  async getSimilarGames(gameId, limit = 5) {
    const game = await this.getGameFeatures(gameId);
    if (!game) {return [];}

    const query = `
      SELECT gf.*,
        (
          CASE WHEN gf.genres LIKE ? THEN 3 ELSE 0 END +
          CASE WHEN ABS(gf.rating - ?) < 0.5 THEN 2 ELSE 0 END +
          CASE WHEN ABS(gf.release_year - ?) < 3 THEN 1 ELSE 0 END
        ) as similarity_score
      FROM game_features gf
      WHERE gf.game_id != ?
      AND gf.genres LIKE ?
      ORDER BY similarity_score DESC, gf.rating DESC
      LIMIT ?
    `;

    const mainGenre = game.genres[0] || '';
    const params = [
      `%"${mainGenre}"%`,
      game.rating,
      game.release_year,
      gameId,
      `%"${mainGenre}"%`,
      limit,
    ];

    const rows = await this.all(query, params);
    return rows.map(row => ({
      ...row,
      genres: JSON.parse(row.genres),
      tags: JSON.parse(row.tags),
    }));
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          logger.info('データベース接続を閉じました');
          resolve();
        }
      });
    });
  }
}

module.exports = new DatabaseService();
