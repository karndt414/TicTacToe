import { useState, useEffect } from 'react'
import { 
  createPlayer, 
  createRoom, 
  joinRoom, 
  subscribeToRoom, 
  getCurrentPlayer,
  joinTeam,
  toggleReady,
  startGame,
  makeMove,
  subscribeToGame,
  leaveRoom,
  createMatch,
  updateMatch,
  subscribeToMatch,
  type Player,
  type Room,
  type Game,
  type Match
} from './utils/supabase'

// Types are imported from utils/supabase

type AppState = 'home' | 'create-room' | 'join-room' | 'lobby' | 'game' | 'mini-game'

interface AppData {
  currentPlayer: Player | null
  currentRoom: Room | null
  roomPlayers: Player[]
  currentGame: Game | null
  currentMatch: Match | null
}

const App = () => {
  const [appState, setAppState] = useState<AppState>('home')
  const [appData, setAppData] = useState<AppData>({
    currentPlayer: null,
    currentRoom: null,
    roomPlayers: [],
    currentGame: null,
    currentMatch: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize app - check for existing session
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true)
        const player = await getCurrentPlayer()
        if (player) {
          setAppData(prev => ({ ...prev, currentPlayer: player }))
        }
      } catch (err) {
        console.error('Failed to initialize app:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  // Subscription cleanup
  useEffect(() => {
    return () => {
      // Clean up any subscriptions when component unmounts
    }
  }, [])

  const resetToHome = () => {
    setAppData({
      currentPlayer: null,
      currentRoom: null,
      roomPlayers: [],
      currentGame: null,
      currentMatch: null
    })
    setAppState('home')
    setError(null)
    localStorage.removeItem('bingo_session_id')
  }

  if (loading && appState === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-white">×</button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded-xl shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-center mt-2">Loading...</p>
          </div>
        </div>
      )}

      {/* Home Screen */}
      {appState === 'home' && (
        <HomeScreen 
          onCreateRoom={() => setAppState('create-room')}
          onJoinRoom={() => setAppState('join-room')}
        />
      )}

      {/* Create Room Screen */}
      {appState === 'create-room' && (
        <CreateRoomScreen 
          onBack={() => setAppState('home')}
      onRoomCreated={async (username: string, roomName: string) => {
            try {
              setLoading(true)
        const player = await createPlayer(username)
        if (!player) throw new Error('Could not create player')
              const room = await createRoom(roomName, player.id)
              if (!room) throw new Error('Could not create room')
              
              setAppData(prev => ({
                ...prev,
                currentPlayer: player,
                currentRoom: room,
                roomPlayers: [player]
              }))
              setAppState('lobby')
              
              // Subscribe to room updates
              const roomChannel = subscribeToRoom(room.id, (players) => {
                setAppData(prev => ({ ...prev, roomPlayers: players }))
              })
        // store channel on window for cleanup if needed
        ;(window as any).__roomChannel?.unsubscribe?.()
        ;(window as any).__roomChannel = roomChannel
            } catch (err: any) {
              setError(err.message || 'Failed to create room')
            } finally {
              setLoading(false)
            }
          }}
        />
      )}

      {/* Join Room Screen */}
      {appState === 'join-room' && (
        <JoinRoomScreen 
          onBack={() => setAppState('home')}
      onRoomJoined={async (username: string, roomCode: string) => {
            try {
              setLoading(true)
        const player = await createPlayer(username)
        if (!player) throw new Error('Could not create player')
              const res = await joinRoom(roomCode, player.id)
              if (!res) throw new Error('Room join failed')
              const { room, players } = res
              
              setAppData(prev => ({
                ...prev,
                currentPlayer: player,
                currentRoom: room,
                roomPlayers: players
              }))
              setAppState('lobby')
              
              // Subscribe to room updates
              const roomChannel = subscribeToRoom(room.id, (updatedPlayers) => {
                setAppData(prev => ({ ...prev, roomPlayers: updatedPlayers }))
              })
        ;(window as any).__roomChannel?.unsubscribe?.()
        ;(window as any).__roomChannel = roomChannel
            } catch (err: any) {
              setError(err.message || 'Failed to join room')
            } finally {
              setLoading(false)
            }
          }}
        />
      )}

      {/* Lobby Screen */}
      {appState === 'lobby' && appData.currentRoom && appData.currentPlayer && (
        <LobbyScreen 
          room={appData.currentRoom}
          players={appData.roomPlayers}
          currentPlayer={appData.currentPlayer}
          onJoinTeam={async (team: 'red' | 'purple') => {
            try {
              setLoading(true)
              await joinTeam(appData.currentPlayer!.id, team)
              const updatedPlayer = { ...appData.currentPlayer!, team }
              setAppData(prev => ({ ...prev, currentPlayer: updatedPlayer }))
            } catch (err: any) {
              setError(err.message || 'Failed to join team')
            } finally {
              setLoading(false)
            }
          }}
          onToggleReady={async () => {
            try {
              setLoading(true)
              await toggleReady(appData.currentPlayer!.id)
              const updatedPlayer = { ...appData.currentPlayer!, is_ready: !appData.currentPlayer!.is_ready }
              setAppData(prev => ({ ...prev, currentPlayer: updatedPlayer }))
            } catch (err: any) {
              setError(err.message || 'Failed to toggle ready status')
            } finally {
              setLoading(false)
            }
          }}
      onStartGame={async () => {
            try {
              setLoading(true)
              const game = await startGame(appData.currentRoom!.id)
              if (!game) throw new Error('Could not start game')
              setAppData(prev => ({ ...prev, currentGame: game }))
              setAppState('game')
              
              // Subscribe to game updates
              const gameChannel = subscribeToGame(game.id, (updatedGame) => {
                setAppData(prev => ({ ...prev, currentGame: updatedGame }))
              })
        ;(window as any).__gameChannel?.unsubscribe?.()
        ;(window as any).__gameChannel = gameChannel
            } catch (err: any) {
              setError(err.message || 'Failed to start game')
            } finally {
              setLoading(false)
            }
          }}
          onLeaveRoom={async () => {
            try {
              setLoading(true)
              if (appData.currentPlayer && appData.currentRoom) {
                await leaveRoom(appData.currentPlayer.id, appData.currentRoom.id)
              }
              resetToHome()
            } catch (err: any) {
              setError(err.message || 'Failed to leave room')
              resetToHome()
            } finally {
              setLoading(false)
            }
          }}
        />
      )}

      {/* Game Screen */}
      {appState === 'game' && appData.currentGame && (
        <GameScreen 
          game={appData.currentGame}
          players={appData.roomPlayers}
      onSquareClick={async (square: number) => {
            try {
              setLoading(true)
        const miniGames = ['rps', 'quick_tap'] as const
        const mini = miniGames[Math.floor(Math.random() * miniGames.length)]
              const match = await createMatch(appData.currentGame!.id, square, mini)
              if (!match) throw new Error('Could not create match')
              setAppData(prev => ({ ...prev, currentMatch: match }))
              setAppState('mini-game')
              
              // Subscribe to match updates
              const matchChannel = subscribeToMatch(match.id, (updatedMatch) => {
                setAppData(prev => ({ ...prev, currentMatch: updatedMatch }))
                if (updatedMatch.status === 'completed') {
                  // Return to game after match completes
                  setTimeout(() => {
                    setAppState('game')
                    setAppData(prev => ({ ...prev, currentMatch: null }))
                  }, 2000)
                }
              })
        ;(window as any).__matchChannel?.unsubscribe?.()
        ;(window as any).__matchChannel = matchChannel
            } catch (err: any) {
              setError(err.message || 'Failed to create match')
            } finally {
              setLoading(false)
            }
          }}
          onLeaveGame={() => resetToHome()}
        />
      )}

      {/* Mini Game Screen */}
      {appState === 'mini-game' && appData.currentMatch && (
        <MiniGameScreen 
          match={appData.currentMatch}
          players={appData.roomPlayers}
          onWin={async (winner: 'red' | 'purple') => {
            try {
              setLoading(true)
              await updateMatch(appData.currentMatch!.id, winner)
              await makeMove(appData.currentGame!.id, appData.currentMatch!.square, winner)
            } catch (err: any) {
              setError(err.message || 'Failed to update match')
            } finally {
              setLoading(false)
            }
          }}
        />
      )}
    </div>
  )
}

// Home Screen Component
const HomeScreen = ({ onCreateRoom, onJoinRoom }: {
  onCreateRoom: () => void
  onJoinRoom: () => void
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎯</div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Team Bingo</h1>
        <p className="text-gray-600 mb-8">The ultimate team competition game!</p>
        
        <div className="space-y-4">
          <button
            onClick={onCreateRoom}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            🏗️ Create Room
          </button>
          
          <button
            onClick={onJoinRoom}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            🚪 Join Room
          </button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>✨ Real-time multiplayer</p>
          <p>🎮 Mini-games included</p>
          <p>👥 Teams of 3 players each</p>
        </div>
      </div>
    </div>
  )
}

// Create Room Screen Component
const CreateRoomScreen = ({ onBack, onRoomCreated }: {
  onBack: () => void
  onRoomCreated: (username: string, roomName: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [roomName, setRoomName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim() && roomName.trim()) {
      onRoomCreated(username.trim(), roomName.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <button
          onClick={onBack}
          className="mb-6 text-gray-500 hover:text-gray-700 flex items-center"
        >
          ← Back
        </button>
        
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏗️</div>
          <h2 className="text-3xl font-bold text-gray-800">Create Room</h2>
          <p className="text-gray-600">Set up a new game room</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your username"
              required
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room Name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter room name"
              required
              maxLength={30}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Create Room 🚀
          </button>
        </form>
      </div>
    </div>
  )
}

// Join Room Screen Component
const JoinRoomScreen = ({ onBack, onRoomJoined }: {
  onBack: () => void
  onRoomJoined: (username: string, roomCode: string) => void
}) => {
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim() && roomCode.trim()) {
      onRoomJoined(username.trim(), roomCode.trim().toUpperCase())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <button
          onClick={onBack}
          className="mb-6 text-gray-500 hover:text-gray-700 flex items-center"
        >
          ← Back
        </button>
        
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🚪</div>
          <h2 className="text-3xl font-bold text-gray-800">Join Room</h2>
          <p className="text-gray-600">Enter a room code to join</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your username"
              required
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition-colors font-mono text-center text-lg"
              placeholder="XXXX"
              required
              maxLength={4}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Join Room 🎯
          </button>
        </form>
      </div>
    </div>
  )
}

// Lobby Screen Component
const LobbyScreen = ({ room, players, currentPlayer, onJoinTeam, onToggleReady, onStartGame, onLeaveRoom }: {
  room: Room
  players: Player[]
  currentPlayer: Player
  onJoinTeam: (team: 'red' | 'purple') => void
  onToggleReady: () => void
  onStartGame: () => void
  onLeaveRoom: () => void
}) => {
  const redPlayers = players.filter(p => p.team === 'red')
  const purplePlayers = players.filter(p => p.team === 'purple')
  const canStart = redPlayers.length === 3 && purplePlayers.length === 3 && 
                   [...redPlayers, ...purplePlayers].every(p => p.is_ready)

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🎯 {room.name}</h1>
              <p className="text-gray-600">Room Code: <span className="font-mono text-lg font-bold">{room.code}</span></p>
            </div>
            <button 
              onClick={onLeaveRoom}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Red Team */}
          <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-2xl shadow-xl p-6 text-white">
            <h2 className="text-2xl font-bold mb-4">🔴 Red Team ({redPlayers.length}/3)</h2>
            <div className="space-y-3 mb-6">
              {redPlayers.map(player => (
                <div key={player.id} className="bg-white bg-opacity-20 backdrop-blur rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{player.username}</span>
                    <span>{player.is_ready ? '✅' : '⏳'}</span>
                  </div>
                </div>
              ))}
              {redPlayers.length < 3 && (
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-3 text-center text-gray-200">
                  Waiting for players...
                </div>
              )}
            </div>
            {!currentPlayer.team && redPlayers.length < 3 && (
              <button
                onClick={() => onJoinTeam('red')}
                className="w-full bg-white text-red-600 font-bold py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Join Red Team
              </button>
            )}
          </div>

          {/* Center Controls */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Game Control</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">You are:</p>
                <p className="font-bold text-lg">{currentPlayer.username}</p>
                <p className="text-sm">Team: {currentPlayer.team ? (
                  <span className={currentPlayer.team === 'red' ? 'text-red-600' : 'text-purple-600'}>
                    {currentPlayer.team.toUpperCase()}
                  </span>
                ) : 'None'}</p>
              </div>

              {currentPlayer.team && (
                <button
                  onClick={onToggleReady}
                  className={`w-full py-3 rounded-lg font-bold transition-colors ${
                    currentPlayer.is_ready 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  }`}
                >
                  {currentPlayer.is_ready ? '✅ Ready!' : '⏳ Mark Ready'}
                </button>
              )}

              {canStart && (
                <button
                  onClick={onStartGame}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🚀 START GAME!
                </button>
              )}

              <div className="text-center text-sm text-gray-500">
                <p>Players: {players.length}/6</p>
                <p>Ready: {players.filter(p => p.is_ready).length}/{players.length}</p>
              </div>
            </div>
          </div>

          {/* Purple Team */}
          <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
            <h2 className="text-2xl font-bold mb-4">🟣 Purple Team ({purplePlayers.length}/3)</h2>
            <div className="space-y-3 mb-6">
              {purplePlayers.map(player => (
                <div key={player.id} className="bg-white bg-opacity-20 backdrop-blur rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{player.username}</span>
                    <span>{player.is_ready ? '✅' : '⏳'}</span>
                  </div>
                </div>
              ))}
              {purplePlayers.length < 3 && (
                <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-3 text-center text-gray-200">
                  Waiting for players...
                </div>
              )}
            </div>
            {!currentPlayer.team && purplePlayers.length < 3 && (
              <button
                onClick={() => onJoinTeam('purple')}
                className="w-full bg-white text-purple-600 font-bold py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Join Purple Team
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Game Screen Component
const GameScreen = ({ game, players, onSquareClick, onLeaveGame }: {
  game: Game
  players: Player[]
  onSquareClick: (square: number) => void
  onLeaveGame: () => void
}) => {
  const redPlayers = players.filter(p => p.team === 'red')
  const purplePlayers = players.filter(p => p.team === 'purple')

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800">🎯 Team Bingo Game</h1>
            <button 
              onClick={onLeaveGame}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              Leave Game
            </button>
          </div>
          
          {game.winner_team ? (
            <div className={`mt-4 p-4 rounded-xl ${game.winner_team === 'red' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'}`}>
              <h2 className="text-2xl font-bold text-center">
                🏆 {game.winner_team.toUpperCase()} TEAM WINS! 🎉
              </h2>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <p className="text-lg">
                Current Turn: <span className={`font-bold ${game.current_turn === 'red' ? 'text-red-500' : 'text-purple-500'}`}>
                  {game.current_turn.toUpperCase()} TEAM
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="grid grid-cols-5 gap-3 max-w-md mx-auto mb-8">
            {game.board_state.map((squareState, i) => (
              <button
                key={i}
                onClick={() => squareState === 'empty' && !game.winner_team && onSquareClick(i)}
                className={`aspect-square border-2 text-lg font-bold rounded-lg transition-all duration-200 ${
                  squareState === 'red' ? 'bg-red-500 text-white border-red-600 shadow-lg' :
                  squareState === 'purple' ? 'bg-purple-500 text-white border-purple-600 shadow-lg' :
                  'bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-gray-400 hover:shadow-md'
                } ${squareState === 'empty' && !game.winner_team ? 'cursor-pointer transform hover:scale-105' : 'cursor-not-allowed'}`}
                disabled={squareState !== 'empty' || !!game.winner_team}
              >
                {squareState === 'empty' ? i + 1 : squareState === 'red' ? '🔴' : '🟣'}
              </button>
            ))}
          </div>

          {/* Team Status */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-red-800 mb-2">🔴 Red Team</h3>
              {redPlayers.map(player => (
                <div key={player.id} className="text-sm text-red-700">
                  {player.username}
                </div>
              ))}
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-purple-800 mb-2">🟣 Purple Team</h3>
              {purplePlayers.map(player => (
                <div key={player.id} className="text-sm text-purple-700">
                  {player.username}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini Game Screen Component
const MiniGameScreen = ({ match, players, onWin }: {
  match: Match
  players: Player[]
  onWin: (winner: 'red' | 'purple') => void
}) => {
  const redPlayer = players.find(p => p.id === match.red_player)
  const purplePlayer = players.find(p => p.id === match.purple_player)

  if (match.mini_game === 'rps') {
    return <RockPaperScissorsGame match={match} redPlayer={redPlayer} purplePlayer={purplePlayer} onWin={onWin} />
  }
  if (match.mini_game === 'quick_tap') {
    return <QuickTapGame match={match} redPlayer={redPlayer} purplePlayer={purplePlayer} onWin={onWin} />
  }
  
  // Placeholder for other mini-games
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-4">🎮 Mini Game: {match.mini_game}</h2>
        <p className="text-gray-600 mb-6">Square: {match.square + 1}</p>
        <p className="mb-6">
          <span className="text-red-600 font-bold">{redPlayer?.username}</span> vs{' '}
          <span className="text-purple-600 font-bold">{purplePlayer?.username}</span>
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onWin('red')}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg"
          >
            🔴 Red Wins
          </button>
          <button
            onClick={() => onWin('purple')}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-lg"
          >
            🟣 Purple Wins
          </button>
        </div>
      </div>
    </div>
  )
}

// Rock Paper Scissors Game Component
const RockPaperScissorsGame = ({ match, redPlayer, purplePlayer, onWin }: {
  match: Match
  redPlayer?: Player
  purplePlayer?: Player
  onWin: (winner: 'red' | 'purple') => void
}) => {
  const [redChoice, setRedChoice] = useState<string | null>(null)
  const [purpleChoice, setPurpleChoice] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)

  const choices = [
    { value: 'rock', emoji: '🪨', label: 'Rock' },
    { value: 'paper', emoji: '📄', label: 'Paper' },
    { value: 'scissors', emoji: '✂️', label: 'Scissors' }
  ]
  
  const playGame = () => {
    if (!redChoice || !purpleChoice) return
    
    if (redChoice === purpleChoice) {
      setResult('tie')
      setShowResult(true)
      return
    }
    
    const redWins = 
      (redChoice === 'rock' && purpleChoice === 'scissors') ||
      (redChoice === 'paper' && purpleChoice === 'rock') ||
      (redChoice === 'scissors' && purpleChoice === 'paper')
    
    const winner = redWins ? 'red' : 'purple'
    setResult(winner)
    setShowResult(true)
    setTimeout(() => onWin(winner), 3000)
  }

  useEffect(() => {
    if (redChoice && purpleChoice && !showResult) {
      setTimeout(() => playGame(), 1000)
    }
  }, [redChoice, purpleChoice, showResult])

  const resetGame = () => {
    setRedChoice(null)
    setPurpleChoice(null)
    setResult(null)
    setShowResult(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">✂️ Rock Paper Scissors</h2>
          <p className="text-gray-600">Square: {match.square + 1}</p>
          <p className="text-lg mt-2">
            <span className="text-red-600 font-bold">{redPlayer?.username || 'Red Player'}</span> vs{' '}
            <span className="text-purple-600 font-bold">{purplePlayer?.username || 'Purple Player'}</span>
          </p>
        </div>
        
        {!showResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Red Player */}
            <div className="bg-red-50 rounded-xl p-6">
              <h3 className="text-xl font-bold text-red-600 mb-4 text-center">🔴 {redPlayer?.username}</h3>
              {!redChoice ? (
                <div className="grid grid-cols-1 gap-3">
                  {choices.map(choice => (
                    <button
                      key={choice.value}
                      onClick={() => setRedChoice(choice.value)}
                      className="bg-white hover:bg-red-100 border-2 border-red-200 hover:border-red-400 rounded-lg p-4 transition-all duration-200 transform hover:scale-105"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">{choice.emoji}</div>
                        <div className="font-semibold">{choice.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center bg-white rounded-lg p-6">
                  <div className="text-6xl mb-2">{choices.find(c => c.value === redChoice)?.emoji}</div>
                  <div className="font-bold text-lg">{choices.find(c => c.value === redChoice)?.label}</div>
                </div>
              )}
            </div>

            {/* Purple Player */}
            <div className="bg-purple-50 rounded-xl p-6">
              <h3 className="text-xl font-bold text-purple-600 mb-4 text-center">🟣 {purplePlayer?.username}</h3>
              {!purpleChoice ? (
                <div className="grid grid-cols-1 gap-3">
                  {choices.map(choice => (
                    <button
                      key={choice.value}
                      onClick={() => setPurpleChoice(choice.value)}
                      className="bg-white hover:bg-purple-100 border-2 border-purple-200 hover:border-purple-400 rounded-lg p-4 transition-all duration-200 transform hover:scale-105"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">{choice.emoji}</div>
                        <div className="font-semibold">{choice.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center bg-white rounded-lg p-6">
                  <div className="text-6xl mb-2">{choices.find(c => c.value === purpleChoice)?.emoji}</div>
                  <div className="font-bold text-lg">{choices.find(c => c.value === purpleChoice)?.label}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-gray-50 rounded-xl p-8 mb-6">
              <div className="flex justify-center items-center gap-8 mb-4">
                <div className="text-center">
                  <div className="text-6xl mb-2">{choices.find(c => c.value === redChoice)?.emoji}</div>
                  <div className="font-bold text-red-600">{redPlayer?.username}</div>
                </div>
                <div className="text-4xl">⚔️</div>
                <div className="text-center">
                  <div className="text-6xl mb-2">{choices.find(c => c.value === purpleChoice)?.emoji}</div>
                  <div className="font-bold text-purple-600">{purplePlayer?.username}</div>
                </div>
              </div>
              
              {result === 'tie' ? (
                <div>
                  <p className="text-2xl font-bold text-gray-600 mb-4">🤝 It's a tie!</p>
                  <button
                    onClick={resetGame}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    Play Again
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-3xl font-bold mb-4 ${result === 'red' ? 'text-red-600' : 'text-purple-600'}`}>
                    🏆 {result === 'red' ? redPlayer?.username : purplePlayer?.username} WINS!
                  </p>
                  <p className="text-gray-600">Returning to game...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

// Quick Tap Mini-Game Component
const QuickTapGame = ({ match, redPlayer, purplePlayer, onWin }: {
  match: Match
  redPlayer?: Player
  purplePlayer?: Player
  onWin: (winner: 'red' | 'purple') => void
}) => {
  const [ready, setReady] = useState(false)
  const [go, setGo] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(3)
  const [winner, setWinner] = useState<'red' | 'purple' | null>(null)

  useEffect(() => {
    let t1: any, t2: any
    if (ready && countdown !== null) {
      t1 = setTimeout(() => setCountdown(countdown - 1), 1000)
      if (countdown === 0) {
        setCountdown(null)
        // random delay to GO
        t2 = setTimeout(() => setGo(true), 500 + Math.random() * 1500)
      }
    }
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [ready, countdown])

  const handleTap = (team: 'red' | 'purple') => {
    if (!go || winner) return
    setWinner(team)
    setGo(false)
    setTimeout(() => onWin(team), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">⚡ Quick Tap</h2>
          <p className="text-gray-600">Be the first to tap when it says GO!</p>
          <p className="text-sm mt-1">Square: {match.square + 1}</p>
        </div>

        {!ready ? (
          <div className="text-center">
            <button
              onClick={() => setReady(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg"
            >
              Start Countdown
            </button>
          </div>
        ) : countdown !== null ? (
          <div className="text-center text-6xl font-extrabold text-gray-700">{countdown}</div>
        ) : !winner ? (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-50 rounded-xl p-6 text-center">
              <div className="font-bold text-red-600 mb-3">🔴 {redPlayer?.username || 'Red'}</div>
              <button
                onClick={() => handleTap('red')}
                className={`w-full text-3xl font-extrabold rounded-xl py-8 ${go ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                disabled={!go}
              >
                TAP!
              </button>
            </div>
            <div className="bg-purple-50 rounded-xl p-6 text-center">
              <div className="font-bold text-purple-600 mb-3">🟣 {purplePlayer?.username || 'Purple'}</div>
              <button
                onClick={() => handleTap('purple')}
                className={`w-full text-3xl font-extrabold rounded-xl py-8 ${go ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                disabled={!go}
              >
                TAP!
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className={`text-3xl font-bold ${winner === 'red' ? 'text-red-600' : 'text-purple-600'}`}>
              🏆 {winner === 'red' ? redPlayer?.username : purplePlayer?.username} wins!
            </p>
            <p className="text-gray-500">Returning to game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
