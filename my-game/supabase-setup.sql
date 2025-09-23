-- ====================================
-- TEAM BINGO GAME - COMPLETE SQL SETUP
-- ====================================
-- Execute this entire file in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- TABLES
-- ====================================

-- Players table (sessions)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Can be null for anonymous users
    username TEXT NOT NULL,
    session_id TEXT UNIQUE NOT NULL, -- Browser session identifier
    team TEXT CHECK (team IN ('red', 'purple')),
    is_ready BOOLEAN DEFAULT FALSE,
    current_room_id UUID,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table for better session management
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- 4-character room code
    host_player_id UUID REFERENCES players(id),
    max_players INTEGER DEFAULT 6,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'full', 'in_progress', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    board_state JSONB DEFAULT '["empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty","empty"]'::jsonb,
    current_turn TEXT DEFAULT 'red' CHECK (current_turn IN ('red', 'purple')),
    status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'ended')),
    winner_team TEXT CHECK (winner_team IN ('red', 'purple')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table (mini-games)
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    square INTEGER NOT NULL CHECK (square >= 0 AND square <= 24),
    red_player UUID REFERENCES players(id),
    purple_player UUID REFERENCES players(id),
    mini_game TEXT NOT NULL CHECK (mini_game IN ('rps', 'tic_tac_toe', 'pong', 'quick_tap', 'math_quiz')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    winner_team TEXT CHECK (winner_team IN ('red', 'purple')),
    game_state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room participants junction table
CREATE TABLE IF NOT EXISTS room_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, player_id)
);

-- Game participants junction table (keep for compatibility)
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, player_id)
);

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team);
CREATE INDEX IF NOT EXISTS idx_players_ready ON players(is_ready);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(current_room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_matches_game_id ON matches(game_id);
CREATE INDEX IF NOT EXISTS idx_matches_square ON matches(square);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_player_id ON room_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_player_id ON game_participants(player_id);

-- ====================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;

-- Players policies (more permissive for anonymous users)
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete players" ON players FOR DELETE USING (true);

-- Rooms policies
CREATE POLICY "Anyone can view rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON rooms FOR UPDATE USING (true);

-- Games policies
CREATE POLICY "Anyone can view games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update games" ON games FOR UPDATE USING (true);

-- Matches policies
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Anyone can create matches" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update matches" ON matches FOR UPDATE USING (true);

-- Room participants policies
CREATE POLICY "Anyone can view room participants" ON room_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join rooms" ON room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave rooms" ON room_participants FOR DELETE USING (true);

-- Game participants policies
CREATE POLICY "Anyone can view game participants" ON game_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join games" ON game_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave games" ON game_participants FOR DELETE USING (true);

-- ====================================
-- TRIGGERS FOR UPDATED_AT
-- ====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- REALTIME SUBSCRIPTIONS
-- ====================================

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE game_participants;

-- ====================================
-- UTILITY FUNCTIONS
-- ====================================

-- Function to generate room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    code TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..4 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM rooms WHERE rooms.code = code) LOOP
        code := '';
        FOR i IN 1..4 LOOP
            code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if room is ready to start (6 players, 3 per team)
CREATE OR REPLACE FUNCTION is_room_ready(room_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    red_count INTEGER;
    purple_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO red_count
    FROM players p
    JOIN room_participants rp ON p.id = rp.player_id
    WHERE rp.room_id = room_uuid AND p.team = 'red' AND p.is_ready = true;
    
    SELECT COUNT(*) INTO purple_count
    FROM players p
    JOIN room_participants rp ON p.id = rp.player_id
    WHERE rp.room_id = room_uuid AND p.team = 'purple' AND p.is_ready = true;
    
    RETURN red_count = 3 AND purple_count = 3;
END;
$$ LANGUAGE plpgsql;

-- Function to check win condition
CREATE OR REPLACE FUNCTION check_bingo_win(board_state JSONB)
RETURNS TEXT AS $$
DECLARE
    board TEXT[];
    line INTEGER[];
    lines INTEGER[][] := ARRAY[
        -- Rows
        ARRAY[0,1,2,3,4], ARRAY[5,6,7,8,9], ARRAY[10,11,12,13,14], ARRAY[15,16,17,18,19], ARRAY[20,21,22,23,24],
        -- Columns  
        ARRAY[0,5,10,15,20], ARRAY[1,6,11,16,21], ARRAY[2,7,12,17,22], ARRAY[3,8,13,18,23], ARRAY[4,9,14,19,24],
        -- Diagonals
        ARRAY[0,6,12,18,24], ARRAY[4,8,12,16,20]
    ];
    i INTEGER;
BEGIN
    -- Convert JSONB to array
    SELECT ARRAY(SELECT jsonb_array_elements_text(board_state)) INTO board;
    
    -- Check each line
    FOREACH line SLICE 1 IN ARRAY lines
    LOOP
        -- Check if all positions in line are 'red'
        IF (SELECT bool_and(board[i+1] = 'red') FROM unnest(line) AS i) THEN
            RETURN 'red';
        END IF;
        
        -- Check if all positions in line are 'purple'
        IF (SELECT bool_and(board[i+1] = 'purple') FROM unnest(line) AS i) THEN
            RETURN 'purple';
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update game status when match is completed
CREATE OR REPLACE FUNCTION handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
    game_record RECORD;
    new_board JSONB;
    winner TEXT;
BEGIN
    -- Only proceed if winner_team was just set
    IF OLD.winner_team IS NULL AND NEW.winner_team IS NOT NULL THEN
        -- Get the current game
        SELECT * INTO game_record FROM games WHERE id = NEW.game_id;
        
        -- Update board state
        new_board := jsonb_set(
            game_record.board_state,
            ARRAY[NEW.square::text],
            to_jsonb(NEW.winner_team::text)
        );
        
        -- Check for win condition
        winner := check_bingo_win(new_board);
        
        -- Update game
        UPDATE games SET
            board_state = new_board,
            current_turn = CASE WHEN game_record.current_turn = 'red' THEN 'purple' ELSE 'red' END,
            status = CASE WHEN winner IS NOT NULL THEN 'ended' ELSE 'in_progress' END,
            winner_team = winner
        WHERE id = NEW.game_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for match completion
CREATE TRIGGER match_completion_trigger
    AFTER UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION handle_match_completion();

-- ====================================
-- SAMPLE DATA (OPTIONAL - for testing)
-- ====================================

-- Insert sample players (uncomment if you want test data)
/*
INSERT INTO players (id, username, team, is_ready) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Alice', 'red', true),
    ('550e8400-e29b-41d4-a716-446655440002', 'Bob', 'red', true),
    ('550e8400-e29b-41d4-a716-446655440003', 'Charlie', 'red', true),
    ('550e8400-e29b-41d4-a716-446655440004', 'Diana', 'purple', true),
    ('550e8400-e29b-41d4-a716-446655440005', 'Eve', 'purple', true),
    ('550e8400-e29b-41d4-a716-446655440006', 'Frank', 'purple', true);

-- Insert sample game
INSERT INTO games (id, status) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'lobby');

-- Add players to game
INSERT INTO game_participants (game_id, player_id) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'),
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002'),
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003'),
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440004'),
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440005'),
    ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440006');
*/

-- ====================================
-- VIEWS FOR EASIER QUERYING
-- ====================================

-- View for game details with participants
CREATE OR REPLACE VIEW game_details AS
SELECT 
    g.*,
    json_agg(
        json_build_object(
            'id', p.id,
            'username', p.username,
            'team', p.team,
            'is_ready', p.is_ready
        )
    ) AS players
FROM games g
LEFT JOIN game_participants gp ON g.id = gp.game_id
LEFT JOIN players p ON gp.player_id = p.id
GROUP BY g.id, g.board_state, g.current_turn, g.status, g.winner_team, g.created_at, g.updated_at;

-- View for active matches with player details
CREATE OR REPLACE VIEW match_details AS
SELECT 
    m.*,
    rp.username AS red_player_name,
    pp.username AS purple_player_name
FROM matches m
LEFT JOIN players rp ON m.red_player = rp.id
LEFT JOIN players pp ON m.purple_player = pp.id;

-- ====================================
-- COMPLETION MESSAGE
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '🎉 Team Bingo Game database setup completed successfully!';
    RAISE NOTICE '📊 Tables created: players, games, matches, game_participants';
    RAISE NOTICE '🔒 Row Level Security enabled with policies';
    RAISE NOTICE '⚡ Realtime subscriptions enabled for all tables';
    RAISE NOTICE '🔧 Utility functions and triggers installed';
    RAISE NOTICE '📱 Ready for React app integration!';
END $$;
