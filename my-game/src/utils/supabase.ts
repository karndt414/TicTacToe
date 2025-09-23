import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Generate a unique session ID for this browser session
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('bingo_session_id')
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    localStorage.setItem('bingo_session_id', sessionId)
  }
  return sessionId
}

// Database types for TypeScript
export interface Player {
  id: string
  user_id?: string
  username: string
  session_id: string
  team: 'red' | 'purple' | null
  is_ready: boolean
  current_room_id?: string
  last_active: string
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  name: string
  code: string
  host_player_id?: string
  max_players: number
  status: 'waiting' | 'full' | 'in_progress' | 'finished'
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  room_id: string
  board_state: ('empty' | 'red' | 'purple')[]
  current_turn: 'red' | 'purple'
  status: 'lobby' | 'in_progress' | 'ended'
  winner_team: 'red' | 'purple' | null
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  game_id: string
  square: number
  red_player: string
  purple_player: string
  mini_game: 'rps' | 'tic_tac_toe' | 'pong' | 'quick_tap'
  winner_team: 'red' | 'purple' | null
  status?: 'pending' | 'active' | 'completed'
  game_state: any
  created_at: string
  updated_at: string
}

export interface RoomParticipant {
  id: string
  room_id: string
  player_id: string
  joined_at: string
}

// Session management
export const getCurrentPlayer = async (): Promise<Player | null> => {
  const sessionId = getSessionId()
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error) {
    console.log('No current player found')
    return null
  }
  return data
}

export const createPlayer = async (username: string): Promise<Player | null> => {
  const sessionId = getSessionId()
  
  // First check if player already exists for this session
  const existingPlayer = await getCurrentPlayer()
  if (existingPlayer) {
    // Update username if different
    if (existingPlayer.username !== username) {
      const { data, error } = await supabase
        .from('players')
        .update({ username, last_active: new Date().toISOString() })
        .eq('session_id', sessionId)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating player:', error)
        return null
      }
      return data
    }
    return existingPlayer
  }

  // Create new player
  const { data, error } = await supabase
    .from('players')
    .insert({
      username,
      session_id: sessionId,
      last_active: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating player:', error)
    return null
  }

  return data
}

// Room management
// Create a room for a given host player
export const createRoom = async (roomName: string, hostPlayerId: string): Promise<Room | null> => {
  try {
    // Generate room code with fallback
    let roomCode: string
    try {
      const { data, error } = await supabase.rpc('generate_room_code')
      if (error || !data) throw error
      roomCode = data
    } catch (error) {
      console.log('RPC failed, generating code locally:', error)
      // Fallback: generate code locally
      roomCode = Array.from({ length: 4 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('')
    }

    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        name: roomName,
        code: roomCode,
        host_player_id: hostPlayerId,
        status: 'waiting'
      })
      .select()
      .single()

    if (roomError) {
      console.error('Error creating room:', roomError)
      return null
    }

    // Add player to room
    await supabase.from('room_participants').insert({
      room_id: room.id,
      player_id: hostPlayerId
    })

    // Update player's current room
    await supabase
      .from('players')
      .update({ current_room_id: room.id })
      .eq('id', hostPlayerId)

    return room
  } catch (error) {
    console.error('Error in createRoom:', error)
    return null
  }
}

export const joinRoom = async (roomCode: string, playerId: string): Promise<{ room: Room; players: Player[] } | null> => {
  try {
    // Find room by code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode.toUpperCase())
      .single()

    if (roomError) {
      console.error('Room not found:', roomError)
      return null
    }

    // Check if room is full
    const { count } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact' })
      .eq('room_id', room.id)

    if (count && count >= room.max_players) {
      console.error('Room is full')
      return null
    }

    // Check if player is already in room
    const { data: existingParticipant } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', room.id)
      .eq('player_id', playerId)
      .single()

    if (!existingParticipant) {
      // Add player to room
      await supabase.from('room_participants').insert({
        room_id: room.id,
        player_id: playerId
      })
    }

    // Update player's current room
    await supabase
      .from('players')
      .update({ current_room_id: room.id })
      .eq('id', playerId)

    // Return players list in room
    const players = await getRoomPlayers(room.id)
    return { room, players }
  } catch (error) {
    console.error('Error in joinRoom:', error)
    return null
  }
}

export const getRoomData = async (roomId: string): Promise<{ room: Room; players: Player[]; game?: Game } | null> => {
  try {
    // Get room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomError) {
      console.error('Error fetching room:', roomError)
      return null
    }

    // Get players in room
    const { data: participants, error: participantsError } = await supabase
      .from('room_participants')
      .select(`
        player_id,
        players!inner(*)
      `)
      .eq('room_id', roomId)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return null
    }

    const players = participants.map(p => p.players).flat()

    // Get current game if exists
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return { room, players, game: game || undefined }
  } catch (error) {
    console.error('Error in getRoomData:', error)
    return null
  }
}

export const joinTeam = async (playerId: string, team: 'red' | 'purple'): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ 
        team,
        is_ready: false // Reset ready status when changing teams
      })
      .eq('id', playerId)

    if (error) {
      console.error('Error joining team:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in joinTeam:', error)
    return false
  }
}

export const setPlayerReady = async (playerId: string, ready: boolean): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ is_ready: ready })
      .eq('id', playerId)

    if (error) {
      console.error('Error setting ready status:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in setPlayerReady:', error)
    return false
  }
}

// Convenience wrapper used by App: flip ready state
export const toggleReady = async (playerId: string): Promise<boolean> => {
  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('is_ready')
      .eq('id', playerId)
      .single()
    if (error || !player) return false
    return setPlayerReady(playerId, !player.is_ready)
  } catch {
    return false
  }
}

export const startGame = async (roomId: string): Promise<Game | null> => {
  try {
    // Create new game for the room
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        room_id: roomId,
        board_state: Array(25).fill('empty'),
        current_turn: 'red',
        status: 'in_progress'
      })
      .select()
      .single()

    if (gameError) {
      console.error('Error creating game:', gameError)
      return null
    }

    // Update room status
    await supabase
      .from('rooms')
      .update({ status: 'in_progress' })
      .eq('id', roomId)

    return game
  } catch (error) {
    console.error('Error in startGame:', error)
    return null
  }
}

// Realtime subscriptions
export const subscribeToRoom = (roomId: string, callback: (players: Player[]) => void) => {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, 
      async () => {
        const players = await getRoomPlayers(roomId)
        callback(players)
      }
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`
      }, 
      async () => {
        const players = await getRoomPlayers(roomId)
        callback(players)
      }
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'players'
      }, 
      async () => {
        const players = await getRoomPlayers(roomId)
        callback(players)
      }
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'games',
        filter: `room_id=eq.${roomId}`
      }, 
      async () => {
        const players = await getRoomPlayers(roomId)
        callback(players)
      }
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'matches'
      }, 
      async () => {
        const players = await getRoomPlayers(roomId)
        callback(players)
      }
    )
    .subscribe()

  // Kick initial callback
  getRoomPlayers(roomId).then(callback).catch(() => {})
  return channel
}

// Helper to get players in a room
const getRoomPlayers = async (roomId: string): Promise<Player[]> => {
  const { data, error } = await supabase
    .from('room_participants')
    .select(
      `players:player_id(*)`
    )
    .eq('room_id', roomId)
  if (error || !data) return []
  // Flatten players
  // @ts-ignore - selecting relation alias
  return data.map((p: any) => p.players)
}

// Game logic helpers
export const challengeSquare = async (gameId: string, square: number, redPlayer: string, purplePlayer: string): Promise<Match | null> => {
  const miniGames = ['rps', 'quick_tap'] as const
  const randomGame = miniGames[Math.floor(Math.random() * miniGames.length)]

  const { data, error } = await supabase
    .from('matches')
    .insert({
      game_id: gameId,
      square: square,
      red_player: redPlayer,
      purple_player: purplePlayer,
      mini_game: randomGame,
      game_state: {}
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating match:', error)
    return null
  }

  return data
}

export const completeMatch = async (matchId: string, winnerTeam: 'red' | 'purple'): Promise<boolean> => {
  const { error: matchError } = await supabase
    .from('matches')
  .update({ winner_team: winnerTeam, status: 'completed' })
    .eq('id', matchId)

  if (matchError) {
    console.error('Error completing match:', matchError)
    return false
  }

  return true
}

export const checkWinCondition = (board: ('empty' | 'red' | 'purple')[]): 'red' | 'purple' | null => {
  const lines = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20]
  ]

  for (const line of lines) {
    const lineValues = line.map(i => board[i])
    if (lineValues.every(val => val === 'red')) return 'red'
    if (lineValues.every(val => val === 'purple')) return 'purple'
  }

  return null
}

// Apply a move to the board when a team wins a match
export const makeMove = async (gameId: string, square: number, team: 'red' | 'purple'): Promise<Game | null> => {
  // Fetch game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()
  if (gameError || !game) return null

  const board = [...game.board_state]
  if (board[square] !== 'empty') return game
  board[square] = team

  const winner = checkWinCondition(board)
  const nextTurn = team === 'red' ? 'purple' : 'red'

  const { data: updated, error: updateError } = await supabase
    .from('games')
    .update({
      board_state: board,
      current_turn: nextTurn,
      winner_team: winner,
      status: winner ? 'ended' : 'in_progress'
    })
    .eq('id', gameId)
    .select()
    .single()
  if (updateError) return null
  return updated
}

// Subscribe to a single game changes
export const subscribeToGame = (gameId: string, callback: (game: Game) => void) => {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, async () => {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
      if (data) callback(data)
    })
    .subscribe()
  return channel
}

// Create a match choosing random players from each team in the room
export const createMatch = async (gameId: string, square: number, miniGame: string): Promise<Match | null> => {
  // Lookup game -> room
  const { data: game } = await supabase
    .from('games')
    .select('room_id')
    .eq('id', gameId)
    .single()
  if (!game) return null

  const players = await getRoomPlayers(game.room_id)
  const red = players.filter(p => p.team === 'red')
  const purple = players.filter(p => p.team === 'purple')
  if (!red.length || !purple.length) return null
  const redPlayer = red[Math.floor(Math.random() * red.length)]
  const purplePlayer = purple[Math.floor(Math.random() * purple.length)]

  const { data, error } = await supabase
    .from('matches')
    .insert({
      game_id: gameId,
      square,
      red_player: redPlayer.id,
      purple_player: purplePlayer.id,
      mini_game: miniGame,
      status: 'active',
      game_state: {}
    })
    .select()
    .single()
  if (error) return null
  return data
}

export const updateMatch = async (matchId: string, winnerTeam: 'red' | 'purple'): Promise<boolean> => {
  return completeMatch(matchId, winnerTeam)
}

export const subscribeToMatch = (matchId: string, callback: (match: Match) => void) => {
  const channel = supabase
    .channel(`match:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()
      if (data) callback(data)
    })
    .subscribe()
  return channel
}

export const leaveRoom = async (playerId: string, roomId: string): Promise<boolean> => {
  try {
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('player_id', playerId)

    await supabase
      .from('players')
      .update({ current_room_id: null, team: null, is_ready: false })
      .eq('id', playerId)

    return true
  } catch (e) {
    return false
  }
}
