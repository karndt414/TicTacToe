# Team Bingo Game 🎯

A real-time multiplayer team-based bingo game built with React, TypeScript, and Supabase.

## 🎮 Game Concept

- **Two Teams**: Red vs Purple (3 players each)
- **Shared Bingo Board**: 5×5 grid
- **Mini-Games**: When a square is challenged, players face off in:
  - Rock Paper Scissors ✂️
  - Tic Tac Toe (coming soon)
  - Pong (coming soon)
- **Win Condition**: First team to complete a row, column, or diagonal wins!

## 🚀 Setup Instructions

### 1. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `supabase-setup.sql`
4. Click "Run" to execute the SQL script

This will create:
- All necessary tables (`players`, `games`, `matches`, `game_participants`)
- Row Level Security policies
- Realtime subscriptions
- Utility functions and triggers
- Database views for easier querying

### 2. Environment Configuration

The `.env.local` file has been created with your Supabase credentials:
```
VITE_SUPABASE_URL=https://magmikrrbiyqtabrhyxy.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies & Run

```bash
npm install
npm run dev
```

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Lobby**: Team selection and ready-up system
- **Game Board**: 5×5 bingo grid with real-time updates
- **Mini-Games**: Interactive challenges between players
- **Realtime Sync**: All game state synchronized via Supabase

### Backend (Supabase)
- **Authentication**: Anonymous login with usernames
- **Database**: PostgreSQL with real-time subscriptions
- **Realtime**: WebSocket connections for live updates
- **Functions**: Server-side game logic and win detection

## 📊 Database Schema

### Core Tables
- `players`: User profiles with team assignments
- `games`: Game instances with board state
- `matches`: Mini-game challenges between players
- `game_participants`: Junction table for game membership

### Key Features
- **Automatic Win Detection**: Server-side function checks for bingo completion
- **Real-time Updates**: All tables have realtime subscriptions enabled
- **Row Level Security**: Proper permissions for multi-tenant access

## 🎯 Realtime Flow

```
Player Action → Supabase Database → Trigger → All Connected Clients
```

### Events Tracked:
1. **Player joins/leaves team** → Update lobby
2. **Player marks ready** → Check if game can start
3. **Square challenged** → Create mini-game match
4. **Mini-game completed** → Update board & check win condition
5. **Game won** → Broadcast winner to all players

## 🎮 How to Play

1. **Join the Game**: Enter username and join anonymously
2. **Pick a Team**: Choose Red or Purple team (max 3 per team)
3. **Ready Up**: Mark yourself as ready when your team is full
4. **Start Game**: Host starts when both teams are ready (6 players total)
5. **Challenge Squares**: Click empty squares to challenge them
6. **Play Mini-Games**: Compete in randomly selected mini-games
7. **Win the Board**: First team to complete a line wins!

## 🔧 Development

### File Structure
```
src/
├── App.tsx              # Main game component
├── utils/
│   └── supabase.ts      # Supabase client & helper functions
├── App.css              # Styles
└── main.tsx             # App entry point
```

### Key Functions
- `subscribeToGame()`: Listen to game state changes
- `createNewGame()`: Initialize new game instance
- `challengeSquare()`: Create mini-game match
- `completeMatch()`: Resolve mini-game and update board
- `checkWinCondition()`: Server-side bingo win detection

## 🎨 UI Components

- **Lobby**: Team assignment and ready status
- **BingoBoard**: 5×5 interactive grid
- **MiniGameComponent**: Modal for mini-games
- **RockPaperScissors**: Fully implemented mini-game

## 🚀 Next Steps

1. **Implement Tic Tac Toe mini-game**
2. **Add Pong mini-game**
3. **Enhance UI with animations**
4. **Add chat functionality**
5. **Implement spectator mode**
6. **Add player statistics**

## 🐛 Troubleshooting

### Common Issues:
1. **Realtime not working**: Check if tables are added to `supabase_realtime` publication
2. **Authentication failing**: Verify environment variables are loaded
3. **Database errors**: Ensure RLS policies are properly configured

### Debug Tools:
- Check browser console for Supabase errors
- Use Supabase dashboard to monitor realtime connections
- Verify database triggers are firing correctly

## 📝 SQL Setup Summary

The `supabase-setup.sql` file includes:
- ✅ Table creation with proper relationships
- ✅ Indexes for optimal performance  
- ✅ Row Level Security policies
- ✅ Realtime subscriptions for all tables
- ✅ Automatic timestamp triggers
- ✅ Win condition checking functions
- ✅ Helper views for complex queries

Execute this file in your Supabase SQL Editor to get started!
