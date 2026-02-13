# Database Schema

## Tables

### leagues
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | varchar(255) | NO | |
| slug | varchar(255) | YES | UNIQUE |
| description | text | YES | |
| discord_url | text | YES | |
| color | varchar(7) | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### divisions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| league_id | integer | NO | FK → leagues.id (CASCADE) |
| name | varchar(255) | NO | |
| tier | integer | YES | |
| slug | varchar(255) | YES | |
| description | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

UNIQUE(league_id, slug)

### seasons
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| league_id | integer | NO | FK → leagues.id (CASCADE) |
| division_id | integer | NO | FK → divisions.id (CASCADE) |
| name | varchar(255) | NO | |
| slug | varchar(255) | YES | |
| start_date | date | YES | |
| end_date | date | YES | |
| is_active | boolean | YES | true |
| description | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

UNIQUE(league_id, division_id, slug)

### teams
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| season_id | integer | NO | FK → seasons.id (CASCADE) |
| name | varchar(255) | NO | |
| color | varchar(50) | NO | |
| slug | varchar(255) | YES | |
| logo_url | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

UNIQUE(season_id, slug)

### players
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | varchar(255) | NO | |
| slug | varchar(255) | YES | UNIQUE |
| discord_name | varchar | YES | |
| discord_id | varchar(32) | YES | |
| tracker_url | text | YES | |
| main_role | varchar(50) | YES | |
| secondary_role | varchar(50) | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### player_aliases
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| player_id | integer | NO | FK → players.id (CASCADE) |
| alias | varchar(255) | NO | |
| created_at | timestamptz | YES | now() |

### league_players
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| player_id | integer | NO | FK → players.id (CASCADE) |
| team_id | integer | NO | FK → teams.id (CASCADE) |
| season_id | integer | NO | FK → seasons.id (CASCADE) |
| role | varchar(50) | YES | |
| is_active | boolean | YES | true |
| joined_date | date | YES | |
| left_date | date | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| secondary_role | varchar | YES | |

UNIQUE(player_id, team_id, season_id, role)

### matches
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| season_id | integer | NO | FK → seasons.id (CASCADE) |
| date | date | NO | |
| team1_id | integer | NO | FK → teams.id (RESTRICT) |
| team2_id | integer | NO | FK → teams.id (RESTRICT) |
| winner_team_id | integer | YES | FK → teams.id (SET NULL) |
| match_type | varchar(50) | YES | 'regular' |
| week | integer | YES | |
| best_of | integer | YES | 1 |
| is_completed | boolean | YES | false |
| notes | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

CHECK (team1_id <> team2_id)

### games
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| match_id | integer | NO | FK → matches.id (CASCADE) |
| game_number | integer | NO | |
| team1_score | integer | YES | 0 |
| team2_score | integer | YES | 0 |
| winner_team_id | integer | YES | FK → teams.id (SET NULL) |
| duration_minutes | integer | YES | |
| is_completed | boolean | YES | false |
| notes | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |
| is_forfeit | boolean | YES | false |

UNIQUE(match_id, game_number)

### player_game_stats
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| game_id | integer | NO | FK → games.id (CASCADE) |
| league_player_id | integer | NO | FK → league_players.id (CASCADE) |
| team_side | integer | NO | |
| god_played | varchar(100) | YES | |
| kills | integer | YES | 0 |
| deaths | integer | YES | 0 |
| assists | integer | YES | 0 |
| damage | integer | YES | 0 |
| mitigated | integer | YES | 0 |
| ally_healing | integer | YES | 0 |
| self_healing | integer | YES | 0 |
| structure_damage | integer | YES | 0 |
| gpm | integer | YES | 0 |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

UNIQUE(game_id, league_player_id)
CHECK (team_side IN (1, 2))

### gods
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | text | NO | UNIQUE |
| slug | text | NO | UNIQUE |
| image_url | text | NO | |

### users
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| discord_id | varchar(32) | NO | UNIQUE |
| discord_username | varchar(100) | YES | |
| discord_avatar | varchar(255) | YES | |
| role | varchar(10) | YES | 'user' |
| linked_player_id | integer | YES | FK → players.id (SET NULL) |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### roles
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | varchar(100) | NO | UNIQUE |
| description | text | YES | |
| is_system | boolean | NO | false |
| created_at | timestamptz | YES | NOW() |

### role_permissions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| role_id | integer | NO | FK → roles.id (CASCADE) |
| permission_key | varchar(50) | NO | |
| created_at | timestamptz | YES | NOW() |

UNIQUE(role_id, permission_key)

Valid permission keys: `match_report`, `roster_manage`, `match_manage`, `player_manage`, `league_manage`, `user_manage`, `claim_manage`, `permission_manage`, `match_schedule`, `audit_log_view`

### user_roles
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| user_id | integer | NO | FK → users.id (CASCADE) |
| role_id | integer | NO | FK → roles.id (CASCADE) |
| league_id | integer | YES | FK → leagues.id (CASCADE), NULL = global |
| granted_by | integer | YES | FK → users.id (SET NULL) |
| created_at | timestamptz | YES | NOW() |

### claim_requests
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| user_id | integer | NO | FK → users.id (CASCADE) |
| player_id | integer | NO | FK → players.id (CASCADE) |
| status | varchar(10) | YES | 'pending' |
| message | text | YES | |
| admin_note | text | YES | |
| resolved_by | integer | YES | FK → users.id (NO ACTION) |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| resolved_at | timestamp | YES | |

### audit_log
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| user_id | integer | YES | FK → users.id (SET NULL) |
| username | varchar(100) | YES | |
| action | varchar(100) | NO | |
| endpoint | varchar(50) | NO | |
| league_id | integer | YES | |
| target_type | varchar(50) | YES | |
| target_id | integer | YES | |
| details | jsonb | YES | |
| created_at | timestamptz | YES | now() |

### scheduled_matches
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| season_id | integer | NO | FK → seasons.id (CASCADE) |
| team1_id | integer | NO | FK → teams.id (CASCADE) |
| team2_id | integer | NO | FK → teams.id (CASCADE) |
| best_of | integer | NO | 1 |
| scheduled_date | date | NO | |
| week | integer | YES | |
| status | varchar(20) | NO | 'scheduled' |
| created_by | integer | YES | FK → users.id (SET NULL) |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| match_id | integer | YES | FK → matches.id (SET NULL) |

| predictions_locked | boolean | NO | false |

CHECK (team1_id <> team2_id)
CHECK (status IN ('scheduled', 'completed', 'cancelled'))

### predictions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| user_id | integer | NO | FK → users.id (CASCADE) |
| scheduled_match_id | integer | NO | FK → scheduled_matches.id (CASCADE) |
| predicted_team_id | integer | NO | FK → teams.id (CASCADE) |
| wager_amount | integer | NO | 0 |
| payout_multiplier | numeric(5,2) | YES | |
| payout_amount | integer | YES | |
| status | varchar(20) | NO | 'pending' |
| created_at | timestamptz | NO | NOW() |
| resolved_at | timestamptz | YES | |

UNIQUE(user_id, scheduled_match_id)
CHECK (status IN ('pending', 'won', 'lost', 'refunded'))
INDEX idx_predictions_match ON (scheduled_match_id)
INDEX idx_predictions_user ON (user_id, status)

### discord_channels
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| channel_id | varchar(32) | NO | UNIQUE |
| channel_name | varchar(255) | YES | |
| guild_id | varchar(32) | NO | |
| guild_name | varchar(255) | YES | |
| division_id | integer | NO | FK → divisions.id (CASCADE) |
| is_active | boolean | NO | true |
| last_message_id | varchar(32) | YES | |
| last_polled_at | timestamptz | YES | |
| created_by | integer | YES | FK → users.id (SET NULL) |
| created_at | timestamptz | YES | NOW() |
| updated_at | timestamptz | YES | NOW() |

### discord_queue
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| channel_id | integer | NO | FK → discord_channels.id (CASCADE) |
| message_id | varchar(32) | NO | |
| attachment_id | varchar(32) | NO | |
| attachment_filename | varchar(500) | YES | |
| attachment_url | text | NO | |
| attachment_size | integer | YES | |
| attachment_width | integer | YES | |
| attachment_height | integer | YES | |
| message_content | text | YES | |
| author_id | varchar(32) | YES | |
| author_name | varchar(100) | YES | |
| message_timestamp | timestamptz | NO | |
| status | varchar(20) | NO | 'pending' |
| used_in_match_id | integer | YES | FK → matches.id (SET NULL) |
| processed_by | integer | YES | FK → users.id (SET NULL) |
| processed_at | timestamptz | YES | |
| created_at | timestamptz | YES | NOW() |

UNIQUE(message_id, attachment_id)
CHECK (status IN ('pending', 'processing', 'used', 'skipped'))

## Views

### season_hierarchy
Denormalized view joining leagues → divisions → seasons.

| Column | Type |
|--------|------|
| league_id | integer |
| league_name | varchar |
| league_slug | varchar |
| division_id | integer |
| division_name | varchar |
| division_tier | integer |
| division_slug | varchar |
| season_id | integer |
| season_name | varchar |
| season_slug | varchar |
| season_is_active | boolean |
| start_date | date |
| end_date | date |

### match_results
Denormalized view of completed matches with team names and win counts.

| Column | Type |
|--------|------|
| match_id | integer |
| date | date |
| week | integer |
| match_type | varchar |
| best_of | integer |
| season_name | varchar |
| division_name | varchar |
| league_name | varchar |
| team1_name | varchar |
| team1_color | varchar |
| team2_name | varchar |
| team2_color | varchar |
| winner_name | varchar |
| is_completed | boolean |
| team1_wins | bigint |
| team2_wins | bigint |

### team_rosters
Denormalized view of team rosters with player details.

| Column | Type |
|--------|------|
| team_id | integer |
| team_name | varchar |
| season_id | integer |
| season_name | varchar |
| division_name | varchar |
| league_name | varchar |
| player_id | integer |
| player_name | varchar |
| role | varchar |
| is_active | boolean |

## Relationships

```
leagues
  ├── divisions (league_id)
  │    ├── seasons (league_id, division_id)
  │    │    ├── teams (season_id)
  │    │    │    └── league_players (team_id, season_id)
  │    │    │         └── player_game_stats (league_player_id)
  │    │    ├── matches (season_id, team1_id, team2_id)
  │    │    │    └── games (match_id)
  │    │    │         └── player_game_stats (game_id)
  │    │    └── scheduled_matches (season_id, team1_id, team2_id)
  │    │         └── matches (match_id, optional link)
  │    └── discord_channels (division_id)
  │         └── discord_queue (channel_id)
  │              └── matches (used_in_match_id, optional link)
  └── user_roles (league_id, optional scope)

players
  ├── player_aliases (player_id)
  ├── league_players (player_id)
  └── users (linked_player_id)

users
  ├── user_roles (user_id)
  ├── claim_requests (user_id, resolved_by)
  ├── audit_log (user_id)
  ├── scheduled_matches (created_by)
  ├── discord_channels (created_by)
  └── discord_queue (processed_by)

gods (standalone lookup table)

roles
  ├── role_permissions (role_id)
  └── user_roles (role_id)
```
