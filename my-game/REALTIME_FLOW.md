# Supabase Realtime Flow for Team Bingo Game

## 🔄 Realtime Architecture Overview

The Team Bingo Game uses Supabase Realtime to synchronize game state across all connected clients in real-time. Here's how the data flows through the system:

## 📡 Realtime Channels & Subscriptions

### 1. Lobby Channel
```typescript
// Subscribe to lobby updates
const lobbySubscription = supabase
  .channel('lobby')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'players' 
  }, handleLobbyUpdate)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'games',
    filter: 'status=eq.lobby' 
  }, handleLobbyUpdate)
  .subscribe()
```

### 2. Game-Specific Channel
```typescript
// Subscribe to specific game updates
const gameSubscription = supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'games',
    filter: `id=eq.${gameId}` 
  }, handleGameUpdate)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'matches',
    filter: `game_id=eq.${gameId}` 
  }, handleMatchUpdate)
  .subscribe()
```

## 🎯 Event Flow Diagrams

### Lobby Phase
```
Player Action               Database Change           Realtime Event            All Clients
─────────────────────────────────────────────────────────────────────────────────────────
Join Team Red      →       players.team = 'red'      →     'UPDATE' event     →    Lobby UI updates
Mark Ready         →       players.is_ready = true   →     'UPDATE' event     →    Ready status shows  
Create Game        →       games table INSERT        →     'INSERT' event     →    Game appears
Start Game         →       games.status = 'in_progress' →  'UPDATE' event     →    Switch to game view
```

### Game Phase
```
Player Action               Database Change           Trigger Function          Realtime Event
─────────────────────────────────────────────────────────────────────────────────────────
Challenge Square   →       matches table INSERT      →    (none)            →    Match modal opens
Complete Mini-Game →       matches.winner_team set   →    Auto-update board →    Board state syncs
                                                     →    Check win condition →   Winner announced
```

### Database Trigger Flow
```
matches.winner_team UPDATE
        ↓
handle_match_completion() trigger
        ↓
1. Get current game board
2. Update board[square] = winner_team  
3. Check win condition with check_bingo_win()
4. Update games table
        ↓
Realtime broadcasts games table UPDATE
        ↓
All clients receive new board state
```

## 🔧 Key Realtime Functions

### subscribeToGame()
- **Purpose**: Listen to all changes for a specific game
- **Tables Watched**: `games`, `matches`, `players`
- **Events**: INSERT, UPDATE, DELETE
- **Filters**: Game-specific and player updates

### subscribeToLobby()  
- **Purpose**: Monitor lobby activity across all games
- **Tables Watched**: `players`, `games` (lobby status only)
- **Events**: All player changes and new game creation

## 📊 Data Synchronization Patterns

### 1. Optimistic Updates
```typescript
// Client immediately updates UI
setGameState(prev => ({ ...prev, isLoading: true }))

// Then syncs with database
const result = await supabase.from('players').update({ is_ready: true })

// Realtime will broadcast the change to all other clients
```

### 2. Event-Driven State Management
```typescript
// All state changes come through realtime events
const handleRealtimeUpdate = (payload) => {
  switch (payload.eventType) {
    case 'INSERT':
      // New player joined, new game created, etc.
      break
    case 'UPDATE':  
      // Player ready status, board state, game status changes
      break
    case 'DELETE':
      // Player left, game ended, etc.
      break
  }
}
```

### 3. Conflict Resolution
- **Server-side functions** handle all game logic
- **Database triggers** ensure consistent state
- **Clients** only send actions, not state changes
- **Realtime** broadcasts the authoritative server state

## 🎮 Mini-Game Realtime Integration

### Rock Paper Scissors Flow
```
Red Player Choice    →    Update matches.game_state.red_choice    →    Purple player sees choice
Purple Player Choice →    Update matches.game_state.purple_choice →    Both players see choices
Determine Winner     →    Update matches.winner_team              →    Trigger board update
Board Update         →    Update games.board_state                →    All players see new board
```

### Future Mini-Games (Tic Tac Toe, Pong)
```typescript
// Tic Tac Toe moves
await supabase
  .from('matches')
  .update({ 
    game_state: { 
      ...currentState, 
      board: newBoard,
      current_player: nextPlayer 
    } 
  })
  .eq('id', matchId)

// Pong paddle positions (high frequency updates)
await supabase
  .from('matches')  
  .update({ 
    game_state: { 
      paddle1_y: newPosition,
      paddle2_y: otherPosition,
      ball_x: ballX,
      ball_y: ballY 
    } 
  })
  .eq('id', matchId)
```

## 🔒 Security & Performance

### Row Level Security
- **Players**: Can only update their own records
- **Games**: Public read, controlled write
- **Matches**: Only match participants can update

### Realtime Optimization
```sql
-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Indexes for efficient filtering
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_matches_game_id ON matches(game_id);
```

### Connection Management
```typescript
// Clean up subscriptions to prevent memory leaks
useEffect(() => {
  const subscription = subscribeToGame(gameId, handleUpdate)
  
  return () => {
    subscription.unsubscribe()
  }
}, [gameId])
```

## 🎯 Event Types Summary

| Event Type | Table | Trigger | Client Action |
|------------|-------|---------|---------------|
| Player joins team | players | UPDATE | Refresh lobby |
| Player ready | players | UPDATE | Update ready count |
| Game created | games | INSERT | Show in lobby |
| Game started | games | UPDATE | Switch to game view |
| Square challenged | matches | INSERT | Open mini-game |
| Mini-game won | matches | UPDATE → games | Update board + check win |
| Game won | games | UPDATE | Show winner screen |

## 🔄 Complete Game Lifecycle

```
1. Lobby Phase
   ├── Players join teams (realtime updates)
   ├── Players mark ready (realtime updates)  
   └── Game starts when 6 ready players
   
2. Game Phase  
   ├── Players challenge squares
   ├── Mini-games resolve automatically
   ├── Board updates via database triggers
   └── Win condition checked server-side
   
3. End Phase
   ├── Winner announced via realtime
   ├── Players can start new game
   └── Cycle repeats
```

This realtime architecture ensures that all players see the same game state simultaneously, with the database serving as the single source of truth and Supabase Realtime handling the synchronization.
