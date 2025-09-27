import { useState, useEffect } from 'react'
import ParticleBackground from './components/ParticleBackground'
import NeonButton from './components/NeonButton'
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
      <>
        <ParticleBackground />
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl border-2 border-cyan-500 neon-glow animate-bounce-in">
            <div className="loading-neon mx-auto"></div>
            <p className="text-center mt-4 text-cyan-400 font-orbitron animate-neon-pulse">LOADING...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ParticleBackground />
      <div className="min-h-screen relative z-10">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-900 text-red-100 px-6 py-3 rounded-lg shadow-lg z-50 border-2 border-red-500 neon-glow-red animate-bounce-in">
          <div className="flex items-center justify-between">
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-100 hover:text-white">×</button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
          <div className="bg-gray-900 p-6 rounded-xl shadow-xl border-2 border-cyan-500 neon-glow">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
            <p className="text-center mt-2 text-cyan-400 font-orbitron">Loading...</p>
          </div>
        </div>
      )}

      {/* Home Screen */}
      {appState === 'home' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl shadow-2xl p-12 max-w-md w-full text-center border-2 border-cyan-500 neon-glow animate-bounce-in">
            <div className="text-6xl mb-6 animate-pulse">🎯</div>
            <h1 className="text-4xl font-bold text-cyan-400 mb-2 font-orbitron animate-neon-pulse">TEAM BINGO</h1>
            <p className="text-gray-300 mb-8">The ultimate team competition game!</p>

            <div className="space-y-4">
              <NeonButton
                onClick={() => setAppState('create-room')}
                variant="primary"
                size="lg"
                className="w-full transform transition-all duration-300 hover:scale-105"
              >
                🏗️ Create Room
              </NeonButton>

              <NeonButton
                onClick={() => setAppState('join-room')}
                variant="secondary"
                size="lg"
                className="w-full transform transition-all duration-300 hover:scale-105"
              >
                🚪 Join Room
              </NeonButton>
            </div>

            <div className="mt-8 text-sm text-gray-400">
              <p className="flex items-center justify-center gap-2">
                <span className="text-cyan-400">✨</span> Real-time multiplayer
              </p>
              <p className="flex items-center justify-center gap-2">
                <span className="text-pink-400">🎮</span> Mini-games included
              </p>
              <p className="flex items-center justify-center gap-2">
                <span className="text-purple-400">👥</span> Teams of 3 players each
              </p>
            </div>
          </div>
        </div>
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
                ; (window as any).__roomChannel?.unsubscribe?.()
                ; (window as any).__roomChannel = roomChannel
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
                ; (window as any).__roomChannel?.unsubscribe?.()
                ; (window as any).__roomChannel = roomChannel
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
              // Mark all players as ready if force starting
              const redPlayers = appData.roomPlayers.filter(p => p.team === 'red')
              const purplePlayers = appData.roomPlayers.filter(p => p.team === 'purple')
              const canStart = redPlayers.length === 3 && purplePlayers.length === 3 &&
                [...redPlayers, ...purplePlayers].every(p => p.is_ready)
              const canForceStart = redPlayers.length >= 1 && purplePlayers.length >= 1
              const isHost = appData.currentPlayer?.id === appData.currentRoom?.host_player_id

              if (!canStart && canForceStart && isHost) {
                // Mark all players as ready
                await Promise.all(
                  appData.roomPlayers
                    .filter(p => !p.is_ready)
                    .map(p => toggleReady(p.id))
                )
                // Wait for the subscription to update the local state
                await new Promise(resolve => setTimeout(resolve, 500))
              }

              // Optionally, fetch the latest players here if your backend supports it
              // const updatedPlayers = await fetchRoomPlayers(appData.currentRoom!.id)
              // setAppData(prev => ({ ...prev, roomPlayers: updatedPlayers }))

              const game = await startGame(appData.currentRoom!.id)
              if (!game) throw new Error('Could not start game')

              // Subscribe to game updates (if not already subscribed)
              const gameChannel = subscribeToGame(game.id, (updatedGame) => {
                setAppData(prev => ({ ...prev, currentGame: updatedGame }))
                // Transition to game screen for all clients when game is available
                if (updatedGame) {
                  setAppState(prevState => prevState !== 'game' ? 'game' : prevState)
                }
              })
                ; (window as any).__gameChannel?.unsubscribe?.()
                ; (window as any).__gameChannel = gameChannel
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
              // Only allow current team to start matches
              if (appData.currentPlayer?.team !== appData.currentGame?.current_turn) {
                setError('Not your turn! Wait for the other team to finish.')
                return
              }
              
              setLoading(true)
              const miniGames = ['rps', 'quick_tap', 'math_quiz'] as const
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
                    // Clean up match subscription when returning to game
                    ;(window as any).__matchChannel?.unsubscribe?.()
                    ;(window as any).__matchChannel = null
                  }, 2000)
                }
              })
              // Clean up previous match subscription before creating new one
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
    </>
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
      <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 border-cyan-500 neon-glow animate-bounce-in">
        <NeonButton
          onClick={onBack}
          variant="secondary"
          size="sm"
          className="mb-6"
        >
          ← Back
        </NeonButton>

        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-pulse">🏗️</div>
          <h2 className="text-3xl font-bold text-cyan-400 mb-2 font-orbitron animate-neon-pulse">Create Room</h2>
          <p className="text-gray-400">Set up a new game room</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Your Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors text-white placeholder-gray-500"
              placeholder="Enter your username"
              required
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors text-white placeholder-gray-500"
              placeholder="Enter room name"
              required
              maxLength={30}
            />
          </div>

          <NeonButton
            type="submit"
            variant="primary"
            size="lg"
            className="w-full transform transition-all duration-300 hover:scale-105"
          >
            Create Room 🚀
          </NeonButton>
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
      <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 border-purple-500 neon-glow animate-bounce-in">
        <NeonButton
          onClick={onBack}
          variant="secondary"
          size="sm"
          className="mb-6"
        >
          ← Back
        </NeonButton>

        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-pulse">🚪</div>
          <h2 className="text-3xl font-bold text-purple-400 mb-2 font-orbitron animate-neon-pulse">Join Room</h2>
          <p className="text-gray-400">Enter a room code to join</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Your Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none transition-colors text-white placeholder-gray-500"
              placeholder="Enter your username"
              required
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-xl focus:border-purple-500 focus:outline-none transition-colors font-mono text-center text-lg text-purple-400"
              placeholder="XXXX"
              required
              maxLength={4}
            />
          </div>

          <NeonButton
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full"
          >
            Join Room 🎯
          </NeonButton>
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
  const canForceStart = redPlayers.length >= 1 && purplePlayers.length >= 1
  const isHost = currentPlayer.id === room.host_player_id

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-8 border-2 border-cyan-500 neon-glow">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-cyan-400 font-orbitron">🎯 {room.name}</h1>
              <p className="text-gray-300">Room Code: <span className="font-mono text-lg font-bold text-cyan-400 bg-gray-800 px-3 py-1 rounded">{room.code}</span></p>
              {isHost && <span className="inline-block bg-yellow-600 text-yellow-100 text-xs px-3 py-1 rounded-full mt-2 font-bold animate-pulse">👑 HOST</span>}
            </div>
            <div className="text-right">
              <NeonButton
                onClick={onLeaveRoom}
                variant="danger"
                size="sm"
                className="mb-2 transform transition-all duration-300 hover:scale-105"
              >
                Leave Room
              </NeonButton>
              <div className="text-sm text-gray-400">
                <p>Players: <span className="text-cyan-400">{players.length}</span>/6</p>
                <p>Ready: <span className="text-green-400">{players.filter(p => p.is_ready).length}</span>/{players.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Red Team */}
          <div className="bg-gradient-to-br from-red-900 to-red-700 rounded-2xl shadow-2xl p-6 text-white border-2 border-red-500 neon-glow animate-slide-in">
            <h2 className="text-2xl font-bold mb-4 font-orbitron animate-pulse">🔴 Red Team ({redPlayers.length}/3)</h2>
            <div className="space-y-3 mb-6">
              {redPlayers.map(player => (
                <div key={player.id} className="bg-red-800 bg-opacity-50 backdrop-blur rounded-lg p-3 border border-red-600 animate-float">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-100">{player.username}</span>
                    <div className="flex items-center space-x-2">
                      <span className={player.is_ready ? 'text-green-400 text-xl' : 'text-yellow-400 text-xl'}>
                        {player.is_ready ? '✅' : '⏳'}
                      </span>
                      {player.id === room.host_player_id && <span className="text-yellow-400 text-lg">👑</span>}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 3 - redPlayers.length) }, (_, i) => (
                <div key={`empty-red-${i}`} className="bg-red-900 bg-opacity-30 backdrop-blur rounded-lg p-3 text-center text-red-300 border-2 border-dashed border-red-500 animate-pulse">
                  Empty slot {redPlayers.length + i + 1}/3
                </div>
              ))}
            </div>
            {!currentPlayer.team && redPlayers.length < 3 && (
              <NeonButton
                onClick={() => onJoinTeam('red')}
                variant="danger"
                size="md"
                className="w-full"
              >
                Join Red Team
              </NeonButton>
            )}
          </div>

          {/* Center Controls */}
          <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 border-2 border-purple-500 neon-glow animate-slide-in" style={{animationDelay: '0.1s'}}>
            <h2 className="text-2xl font-bold text-purple-400 mb-6 text-center font-orbitron">Game Control</h2>

            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-sm text-gray-400 mb-1">You are:</p>
                <p className="font-bold text-lg text-cyan-400">{currentPlayer.username}</p>
                <p className="text-sm">Team: {currentPlayer.team ? (
                  <span className={currentPlayer.team === 'red' ? 'text-red-400' : 'text-purple-400'}>
                    {currentPlayer.team.toUpperCase()}
                  </span>
                ) : <span className="text-gray-500">None</span>}</p>
              </div>

              {currentPlayer.team && (
                <NeonButton
                  onClick={onToggleReady}
                  variant={currentPlayer.is_ready ? "success" : "secondary"}
                  size="md"
                  className="w-full transform transition-all duration-300 hover:scale-105"
                >
                  {currentPlayer.is_ready ? '✅ Ready!' : '⏳ Mark Ready'}
                </NeonButton>
              )}

              {canStart && (
                <NeonButton
                  onClick={onStartGame}
                  variant="primary"
                  size="lg"
                  className="w-full text-lg transform transition-all duration-300 hover:scale-105"
                >
                  🚀 START GAME!
                </NeonButton>
              )}

              {!canStart && canForceStart && isHost && (
                <div className="space-y-2">
                  <div className="text-center text-sm text-yellow-400 bg-yellow-900 bg-opacity-50 rounded-lg p-2 border border-yellow-600">
                    <p>⚠️ Ideal: 3 players per team, all ready</p>
                    <p>Current: {redPlayers.length} red, {purplePlayers.length} purple</p>
                  </div>
                  <NeonButton
                    onClick={onStartGame}
                    variant="danger"
                    size="md"
                    className="w-full transform transition-all duration-300 hover:scale-105"
                  >
                    ⚡ FORCE START (Host Only)
                  </NeonButton>
                </div>
              )}

              {!canForceStart && (
                <div className="text-center text-sm text-gray-500 bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p>⏳ Need at least 1 player on each team to start</p>
                  <p>Red: <span className="text-red-400">{redPlayers.length}</span> | Purple: <span className="text-purple-400">{purplePlayers.length}</span></p>
                </div>
              )}

              <div className="text-center text-sm text-gray-400">
                <p>💡 <strong className="text-cyan-400">Optimal:</strong> 3v3 teams, all ready</p>
                <p>📊 <strong className="text-purple-400">Current:</strong> {redPlayers.length} red vs {purplePlayers.length} purple</p>
                {isHost && !canStart && canForceStart && (
                  <p className="text-orange-400 font-medium mt-1 animate-pulse">🔑 You can force start as host</p>
                )}
              </div>
            </div>
          </div>

          {/* Purple Team */}
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-2xl shadow-2xl p-6 text-white border-2 border-purple-500 neon-glow animate-slide-in" style={{animationDelay: '0.2s'}}>
            <h2 className="text-2xl font-bold mb-4 font-orbitron animate-pulse">🟣 Purple Team ({purplePlayers.length}/3)</h2>
            <div className="space-y-3 mb-6">
              {purplePlayers.map(player => (
                <div key={player.id} className="bg-purple-800 bg-opacity-50 backdrop-blur rounded-lg p-3 border border-purple-600 animate-float">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-purple-100">{player.username}</span>
                    <div className="flex items-center space-x-2">
                      <span className={player.is_ready ? 'text-green-400 text-xl' : 'text-yellow-400 text-xl'}>
                        {player.is_ready ? '✅' : '⏳'}
                      </span>
                      {player.id === room.host_player_id && <span className="text-yellow-400 text-lg">👑</span>}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 3 - purplePlayers.length) }, (_, i) => (
                <div key={`empty-purple-${i}`} className="bg-purple-900 bg-opacity-30 backdrop-blur rounded-lg p-3 text-center text-purple-300 border-2 border-dashed border-purple-500 animate-pulse">
                  Empty slot {purplePlayers.length + i + 1}/3
                </div>
              ))}
            </div>
            {!currentPlayer.team && purplePlayers.length < 3 && (
              <NeonButton
                onClick={() => onJoinTeam('purple')}
                variant="secondary"
                size="md"
                className="w-full"
              >
                Join Purple Team
              </NeonButton>
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
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-8 border-2 border-cyan-500 neon-glow">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-cyan-400 font-orbitron">🎯 Team Bingo Game</h1>
            <NeonButton
              onClick={onLeaveGame}
              variant="danger"
              size="sm"
              className="transform transition-all duration-300 hover:scale-105"
            >
              Leave Game
            </NeonButton>
          </div>

          {game.winner_team ? (
            <div className={`mt-4 p-4 rounded-xl border-2 ${game.winner_team === 'red' ? 'bg-red-900 border-red-500 text-red-100' : 'bg-purple-900 border-purple-500 text-purple-100'} neon-glow animate-pulse animate-neon-glow`}>
              <Confetti
                className="absolute inset-0 pointer-events-none"
                numberOfPieces={200}
                recycle={false}
                tweenDuration={3000}
                initialVelocityY={-500}
                initialVelocityX={-100}
                gravity={0.5}
              />
              <h2 className="text-2xl font-bold text-center font-orbitron animate-neon-pulse">
                🏆 {game.winner_team.toUpperCase()} TEAM WINS! 🎉
              </h2>
            </div>
          ) : (
            <div className="mt-4">
              <div className={`p-4 rounded-xl border-2 ${game.current_turn === 'red' ? 'bg-red-900 border-red-500 text-red-100' : 'bg-purple-900 border-purple-500 text-purple-100'} neon-glow animate-pulse animate-neon-glow`}>
                <p className="text-lg text-center">
                  <span className="font-bold text-2xl font-orbitron animate-neon-pulse">
                    🎯 {game.current_turn.toUpperCase()} TEAM'S TURN
                  </span>
                </p>
                <p className="text-sm text-center mt-2 opacity-75">
                  Click any empty square to start a mini-game challenge!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border-2 border-purple-500 neon-glow animate-neon-glow">
          <div className="grid grid-cols-5 gap-3 max-w-md mx-auto mb-8">
            {game.board_state.map((squareState, i) => (
              <button
                key={i}
                onClick={() => squareState === 'empty' && !game.winner_team && onSquareClick(i)}
                className={`aspect-square border-2 text-lg font-bold rounded-lg transition-all duration-300 transform hover:scale-105 ${
                  squareState === 'red'
                    ? 'bg-red-600 text-white border-red-400 shadow-lg neon-glow-red animate-pulse animate-neon-glow'
                    : squareState === 'purple'
                      ? 'bg-purple-600 text-white border-purple-400 shadow-lg neon-glow-purple animate-pulse animate-neon-glow'
                      : 'bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-cyan-400 hover:shadow-lg hover:neon-glow cursor-pointer'
                } ${squareState === 'empty' && !game.winner_team ? 'hover:scale-105' : 'cursor-not-allowed opacity-50'}`}
                disabled={squareState !== 'empty' || !!game.winner_team}
              >
                {squareState === 'empty' ? (
                  <span className="text-cyan-400 font-orbitron animate-neon-pulse">{i + 1}</span>
                ) : squareState === 'red' ? (
                  <span className="text-2xl animate-bounce">🔴</span>
                ) : (
                  <span className="text-2xl animate-bounce">🟣</span>
                )}
              </button>
            ))}
          </div>

          {/* Team Status */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-900 bg-opacity-50 rounded-xl p-4 border border-red-600 neon-glow-red animate-neon-glow">
              <h3 className="text-lg font-bold text-red-400 mb-2 font-orbitron animate-neon-pulse">🔴 Red Team</h3>
              {redPlayers.map(player => (
                <div key={player.id} className="text-sm text-red-300 animate-float">
                  {player.username}
                </div>
              ))}
            </div>
            <div className="bg-purple-900 bg-opacity-50 rounded-xl p-4 border border-purple-600 neon-glow-purple animate-neon-glow" style={{animationDelay: '0.2s'}}>
              <h3 className="text-lg font-bold text-purple-400 mb-2 font-orbitron animate-neon-pulse">🟣 Purple Team</h3>
              {purplePlayers.map(player => (
                <div key={player.id} className="text-sm text-purple-300 animate-float">
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
  if (match.mini_game === 'math_quiz') {
    return <MathQuizGame match={match} redPlayer={redPlayer} purplePlayer={purplePlayer} onWin={onWin} />
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
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-2 border-cyan-500 neon-glow">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-cyan-400 mb-2 font-orbitron">✂️ Rock Paper Scissors</h2>
          <p className="text-gray-400">Square: {match.square + 1}</p>
          <p className="text-lg mt-2">
            <span className="text-red-400 font-bold">{redPlayer?.username || 'Red Player'}</span> vs{' '}
            <span className="text-purple-400 font-bold">{purplePlayer?.username || 'Purple Player'}</span>
          </p>
        </div>

        {!showResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Red Player */}
            <div className="bg-red-900 bg-opacity-50 rounded-xl p-6 border border-red-600 neon-glow-red animate-float">
              <h3 className="text-xl font-bold text-red-400 mb-4 text-center font-orbitron">🔴 {redPlayer?.username}</h3>
              {!redChoice ? (
                <div className="grid grid-cols-1 gap-3">
                  {choices.map(choice => (
                    <button
                      key={choice.value}
                      onClick={() => setRedChoice(choice.value)}
                      className="bg-red-800 hover:bg-red-700 border-2 border-red-500 hover:border-red-300 rounded-lg p-4 transition-all duration-200 transform hover:scale-105 hover:neon-glow-red"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">{choice.emoji}</div>
                        <div className="font-semibold text-red-200">{choice.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center bg-red-800 rounded-lg p-6 border border-red-500">
                  <div className="text-6xl mb-2 animate-pulse">{choices.find(c => c.value === redChoice)?.emoji}</div>
                  <div className="font-bold text-lg text-red-200">{choices.find(c => c.value === redChoice)?.label}</div>
                </div>
              )}
            </div>

            {/* Purple Player */}
            <div className="bg-purple-900 bg-opacity-50 rounded-xl p-6 border border-purple-600 neon-glow-purple animate-float" style={{animationDelay: '0.1s'}}>
              <h3 className="text-xl font-bold text-purple-400 mb-4 text-center font-orbitron">🟣 {purplePlayer?.username}</h3>
              {!purpleChoice ? (
                <div className="grid grid-cols-1 gap-3">
                  {choices.map(choice => (
                    <button
                      key={choice.value}
                      onClick={() => setPurpleChoice(choice.value)}
                      className="bg-purple-800 hover:bg-purple-700 border-2 border-purple-500 hover:border-purple-300 rounded-lg p-4 transition-all duration-200 transform hover:scale-105 hover:neon-glow-purple"
                    >
                      <div className="text-center">
                        <div className="text-3xl mb-2">{choice.emoji}</div>
                        <div className="font-semibold text-purple-200">{choice.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center bg-purple-800 rounded-lg p-6 border border-purple-500">
                  <div className="text-6xl mb-2 animate-pulse">{choices.find(c => c.value === purpleChoice)?.emoji}</div>
                  <div className="font-bold text-lg text-purple-200">{choices.find(c => c.value === purpleChoice)?.label}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-gray-800 rounded-xl p-8 mb-6 border border-cyan-500 neon-glow">
              <div className="flex justify-center items-center gap-8 mb-4">
                <div className="text-center">
                  <div className="text-6xl mb-2 animate-bounce">{choices.find(c => c.value === redChoice)?.emoji}</div>
                  <div className="font-bold text-red-400">{redPlayer?.username}</div>
                </div>
                <div className="text-4xl text-cyan-400 animate-pulse">⚔️</div>
                <div className="text-center">
                  <div className="text-6xl mb-2 animate-bounce">{choices.find(c => c.value === purpleChoice)?.emoji}</div>
                  <div className="font-bold text-purple-400">{purplePlayer?.username}</div>
                </div>
              </div>

              {result === 'tie' ? (
                <div>
                  <p className="text-2xl font-bold text-gray-400 mb-4">🤝 It's a tie!</p>
                  <NeonButton
                    onClick={resetGame}
                    variant="secondary"
                    size="md"
                  >
                    Play Again
                  </NeonButton>
                </div>
              ) : (
                <div>
                  <p className={`text-3xl font-bold mb-4 ${result === 'red' ? 'text-red-400' : 'text-purple-400'} animate-pulse`}>
                    🏆 {result === 'red' ? redPlayer?.username : purplePlayer?.username} WINS!
                  </p>
                  <p className="text-gray-400">Returning to game...</p>
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

// Math Quiz Mini-Game Component
const MathQuizGame = ({ match, redPlayer, purplePlayer, onWin }: {
  match: Match
  redPlayer?: Player
  purplePlayer?: Player
  onWin: (winner: 'red' | 'purple') => void
}) => {
  const [question, setQuestion] = useState<{ text: string; answer: number; options: number[] } | null>(null)
  const [redAnswer, setRedAnswer] = useState<number | null>(null)
  const [purpleAnswer, setPurpleAnswer] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(10)
  const [showResult, setShowResult] = useState(false)

  // Generate random math question
  useEffect(() => {
    const operations = ['+', '-', '×'] as const
    const op = operations[Math.floor(Math.random() * operations.length)]
    let a = Math.floor(Math.random() * 20) + 1
    let b = Math.floor(Math.random() * 20) + 1
    let answer: number
    let text: string

    switch (op) {
      case '+':
        answer = a + b
        text = `${a} + ${b}`
        break
      case '-':
        if (a < b) [a, b] = [b, a] // Ensure positive result
        answer = a - b
        text = `${a} - ${b}`
        break
      case '×':
        a = Math.floor(Math.random() * 12) + 1
        b = Math.floor(Math.random() * 12) + 1
        answer = a * b
        text = `${a} × ${b}`
        break
    }

    // Generate wrong options
    const options = [answer]
    while (options.length < 4) {
      const wrong = answer + Math.floor(Math.random() * 10) - 5
      if (wrong > 0 && !options.includes(wrong)) {
        options.push(wrong)
      }
    }

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }

    setQuestion({ text, answer, options })
  }, [])

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0 && !showResult) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !showResult) {
      evaluateAnswers()
    }
  }, [timeLeft, showResult])

  const evaluateAnswers = () => {
    if (!question) return

    const redCorrect = redAnswer === question.answer
    const purpleCorrect = purpleAnswer === question.answer

    if (redCorrect && !purpleCorrect) {
      onWin('red')
    } else if (purpleCorrect && !redCorrect) {
      onWin('purple')
    } else if (redCorrect && purpleCorrect) {
      // Both correct - faster wins (simulate by random for now)
      onWin(Math.random() < 0.5 ? 'red' : 'purple')
    } else {
      // Both wrong - random
      onWin(Math.random() < 0.5 ? 'red' : 'purple')
    }
    setShowResult(true)
  }

  if (!question) return <div className="text-cyan-400 font-orbitron">Loading...</div>

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-2 border-cyan-500 neon-glow">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-cyan-400 mb-2 font-orbitron animate-neon-pulse">🧮 Math Quiz</h2>
          <p className="text-gray-400">First to answer correctly wins!</p>
          <p className="text-sm mt-1">Square: {match.square + 1}</p>
          <div className="text-2xl font-bold text-red-400 mt-2 animate-pulse">⏰ {timeLeft}s</div>
        </div>

        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-cyan-400 mb-4 font-orbitron">{question.text} = ?</div>
        </div>

        {!showResult ? (
          <div className="grid grid-cols-2 gap-6">
            {/* Red Player */}
            <div className="bg-red-900 bg-opacity-50 rounded-xl p-6 border border-red-600 neon-glow-red animate-float">
              <h3 className="text-xl font-bold text-red-400 mb-4 text-center font-orbitron">🔴 {redPlayer?.username}</h3>
              <div className="grid grid-cols-2 gap-2">
                {question.options.map(option => (
                  <button
                    key={option}
                    onClick={() => setRedAnswer(option)}
                    className={`p-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                      redAnswer === option
                        ? 'bg-red-600 text-white neon-glow-red'
                        : 'bg-red-800 hover:bg-red-700 border-2 border-red-500 hover:border-red-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Purple Player */}
            <div className="bg-purple-900 bg-opacity-50 rounded-xl p-6 border border-purple-600 neon-glow-purple animate-float" style={{animationDelay: '0.1s'}}>
              <h3 className="text-xl font-bold text-purple-400 mb-4 text-center font-orbitron">🟣 {purplePlayer?.username}</h3>
              <div className="grid grid-cols-2 gap-2">
                {question.options.map(option => (
                  <button
                    key={option}
                    onClick={() => setPurpleAnswer(option)}
                    className={`p-3 rounded-lg font-bold transition-all transform hover:scale-105 ${
                      purpleAnswer === option
                        ? 'bg-purple-600 text-white neon-glow-purple'
                        : 'bg-purple-800 hover:bg-purple-700 border-2 border-purple-500 hover:border-purple-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-gray-800 rounded-xl p-6 border border-cyan-500 neon-glow">
              <div className="text-3xl font-bold text-cyan-400 mb-4 font-orbitron">Answer: {question.answer}</div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`p-3 rounded-lg ${redAnswer === question.answer ? 'bg-green-900 border-green-500 text-green-400' : 'bg-red-900 border-red-500 text-red-400'}`}>
                  {redPlayer?.username}: {redAnswer ?? 'No answer'} {redAnswer === question.answer ? '✅' : '❌'}
                </div>
                <div className={`p-3 rounded-lg ${purpleAnswer === question.answer ? 'bg-green-900 border-green-500 text-green-400' : 'bg-purple-900 border-purple-500 text-purple-400'}`}>
                  {purplePlayer?.username}: {purpleAnswer ?? 'No answer'} {purpleAnswer === question.answer ? '✅' : '❌'}
                </div>
              </div>
              <p className="text-gray-400">Returning to game...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-2xl w-full border-2 border-purple-500 neon-glow">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-purple-400 mb-2 font-orbitron animate-neon-pulse">⚡ Quick Tap</h2>
          <p className="text-gray-400">Be the first to tap when it says GO!</p>
          <p className="text-sm mt-1">Square: {match.square + 1}</p>
        </div>

        {!ready ? (
          <div className="text-center">
            <NeonButton
              onClick={() => setReady(true)}
              variant="primary"
              size="md"
              className="text-lg"
            >
              Start Countdown
            </NeonButton>
          </div>
        ) : countdown !== null ? (
          <div className="text-center text-6xl font-extrabold text-cyan-400 font-orbitron animate-pulse">{countdown}</div>
        ) : !winner ? (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-900 bg-opacity-50 rounded-xl p-6 text-center border border-red-600 neon-glow-red animate-float">
              <div className="font-bold text-red-400 mb-3 font-orbitron">🔴 {redPlayer?.username || 'Red'}</div>
              <button
                onClick={() => handleTap('red')}
                className={`w-full text-3xl font-extrabold rounded-xl py-8 transition-all transform hover:scale-105 ${
                  go
                    ? 'bg-red-600 hover:bg-red-700 text-white neon-glow-red cursor-pointer'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!go}
              >
                TAP!
              </button>
            </div>
            <div className="bg-purple-900 bg-opacity-50 rounded-xl p-6 text-center border border-purple-600 neon-glow-purple animate-float" style={{animationDelay: '0.1s'}}>
              <div className="font-bold text-purple-400 mb-3 font-orbitron">🟣 {purplePlayer?.username || 'Purple'}</div>
              <button
                onClick={() => handleTap('purple')}
                className={`w-full text-3xl font-extrabold rounded-xl py-8 transition-all transform hover:scale-105 ${
                  go
                    ? 'bg-purple-600 hover:bg-purple-700 text-white neon-glow-purple cursor-pointer'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!go}
              >
                TAP!
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className={`text-3xl font-bold ${winner === 'red' ? 'text-red-400' : 'text-purple-400'} animate-pulse font-orbitron`}>
              🏆 {winner === 'red' ? redPlayer?.username : purplePlayer?.username} wins!
            </p>
            <p className="text-gray-400">Returning to game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
