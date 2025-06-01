module.exports = {
  STEAM_API_BASE_URL: 'https://api.steampowered.com',
  STEAM_STORE_BASE_URL: 'https://store.steampowered.com',
  RAWG_API_BASE_URL: 'https://api.rawg.io/api',
  ITAD_API_BASE_URL: 'https://api.isthereanydeal.com/v01',
  
  CACHE_DURATION: {
    STEAM_APP_LIST: 24 * 60 * 60 * 1000, // 24 hours
    GAME_DETAILS: 6 * 60 * 60 * 1000,     // 6 hours
  },
  
  API_TIMEOUT: 5000, // 5 seconds
  
  EMBED_COLORS: {
    INFO: 0x171A21,     // Steam dark color
    SUCCESS: 0x5BA839,  // Steam green
    ERROR: 0xCD201F,    // Steam red
    WARNING: 0xFFA500,  // Orange
  },
  
  MAX_DESCRIPTION_LENGTH: 300,
  MAX_GENRE_DISPLAY: 3,
};