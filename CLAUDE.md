# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Steam Game Suggester Discord Bot - A Discord bot that provides Steam game information and recommendations to Discord users using slash commands.

## Key Commands

### Development Setup
```bash
# Install dependencies
npm install

# Run the bot in development mode
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Build for production
npm run build
```

### Git Workflow
- Create feature branches from `develop`: `git checkout -b feature/<feature-name>`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- Create PRs to merge into `develop`, never commit directly to `main`

## Architecture & Structure

### Directory Layout
```
/steam/
├── commands/       # Discord slash command handlers
├── services/       # API integrations (Steam, RAWG, IsThereAnyDeal)
├── utils/          # Utility functions and helpers
├── cache/          # Cached data (Steam app list, etc.)
├── config/         # Configuration files
└── index.js        # Bot entry point
```

### Core Technologies
- **Runtime**: Node.js with JavaScript
- **Discord Library**: discord.js v13+ (for slash commands and components)
- **HTTP Client**: axios or node-fetch
- **Testing**: Jest
- **Environment Variables**: dotenv for secrets management

### API Integrations
1. **Steam Web API**
   - `GetAppList`: Cache locally for game list
   - `appdetails`: Fetch detailed game information
   
2. **RAWG API**
   - Genre-based game searches
   - Game ratings and metadata
   
3. **IsThereAnyDeal API**
   - Current sale information
   - Price tracking

### Key Implementation Details

#### Slash Commands Structure
All commands follow the `/steam <subcommand>` pattern:
- `/steam info <game_name>` - Search for specific game
- `/steam おすすめ` or `/steam random` - Random game recommendation
- `/steam お得な情報` - Current sales
- `/steam genre <genre>` - Genre-specific recommendations
- `/steam トップ評価` - Highly-rated games
- `/steam price <max_price>` or `/steam free` - Price-filtered games

#### Response Format
All responses use Discord Embeds with:
- Title: Game name (linked to Steam store)
- Description: Brief overview
- Fields: Genre, Rating, Price, Release Date
- Image: Game header image
- Footer: Data source attribution

#### Component Interactions
- Use Buttons for "Recommend another" functionality
- Use SelectMenus when multiple game candidates are found
- Implement pagination for lists using Button components

### Security Considerations
- Store all API keys in `.env` file (never commit)
- Required environment variables:
  - `DISCORD_BOT_TOKEN`
  - `STEAM_API_KEY`
  - `RAWG_API_KEY`
  - `ITAD_API_KEY`

### Error Handling Patterns
```javascript
// Use async/await with try-catch
try {
  const gameData = await fetchGameDetails(appId);
  // Process data
} catch (error) {
  logger.error('Failed to fetch game details:', error);
  await interaction.reply({ 
    content: 'ゲーム情報の取得に失敗しました。',
    ephemeral: true 
  });
}
```

### Performance Considerations
- Cache Steam app list locally (update periodically)
- Implement request throttling for API calls
- Use connection pooling for HTTP requests
- Handle API timeouts gracefully (default: 5s)

## Development Priorities

1. **High Priority** (implement first):
   - Basic bot setup with slash command registration
   - `/steam info` command with game search
   - `/steam おすすめ` random recommendation
   
2. **Medium Priority** (after core features):
   - `/steam お得な情報` sale information
   - `/steam genre` genre-based recommendations
   - `/steam トップ評価` highly-rated games
   
3. **Low Priority** (if resources allow):
   - `/steam price` price-based filtering
   - Advanced filtering options

## Testing Requirements
- Unit tests for all utility functions
- Integration tests for API wrappers
- Mock external API calls in tests
- Minimum 80% code coverage target