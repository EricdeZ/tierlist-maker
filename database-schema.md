# Database Schema

## Tables

### leagues
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | varchar | NO | |
| slug | varchar | YES | |
| description | text | YES | |
| discord_url | text | YES | |
| color | varchar(7) | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### divisions
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| league_id | integer | NO | FK → leagues.id |
| name | varchar | NO | |
| tier | integer | YES | |
| slug | varchar | YES | |
| description | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### seasons
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| league_id | integer | NO | FK → leagues.id |
| division_id | integer | NO | FK → divisions.id |
| name | varchar | NO | |
| slug | varchar | YES | |
| start_date | date | YES | |
| end_date | date | YES | |
| is_active | boolean | YES | true |
| description | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### teams
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| season_id | integer | NO | FK → seasons.id |
| name | varchar | NO | |
| color | varchar | NO | |
| slug | varchar | YES | |
| logo_url | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### players
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | varchar | NO | |
| slug | varchar | YES | |
| discord_name | varchar | YES | |
| tracker_url | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### player_aliases
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| player_id | integer | NO | FK → players.id |
| alias | varchar | NO | |
| created_at | timestamptz | YES | now() |

### league_players
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| player_id | integer | NO | FK → players.id |
| team_id | integer | NO | FK → teams.id |
| season_id | integer | NO | FK → seasons.id |
| role | varchar | YES | |
| secondary_role | varchar | YES | |
| is_active | boolean | YES | true |
| joined_date | date | YES | |
| left_date | date | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### matches
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| season_id | integer | NO | FK → seasons.id |
| date | date | NO | |
| team1_id | integer | NO | FK → teams.id |
| team2_id | integer | NO | FK → teams.id |
| winner_team_id | integer | YES | FK → teams.id |
| match_type | varchar | YES | 'regular' |
| week | integer | YES | |
| best_of | integer | YES | 1 |
| is_completed | boolean | YES | false |
| notes | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### games
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| match_id | integer | NO | FK → matches.id |
| game_number | integer | NO | |
| team1_score | integer | YES | 0 |
| team2_score | integer | YES | 0 |
| winner_team_id | integer | YES | FK → teams.id |
| duration_minutes | integer | YES | |
| is_completed | boolean | YES | false |
| notes | text | YES | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP |

### player_game_stats
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| game_id | integer | NO | FK → games.id |
| league_player_id | integer | NO | FK → league_players.id |
| team_side | integer | NO | (1 or 2) |
| god_played | varchar | YES | |
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

### gods
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | auto-increment |
| name | text | NO | |
| slug | text | NO | |
| image_url | text | NO | |

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
  └── divisions (league_id)
       └── seasons (league_id, division_id)
            ├── teams (season_id)
            │    └── league_players (team_id, season_id)
            │         └── player_game_stats (league_player_id)
            └── matches (season_id, team1_id, team2_id)
                 └── games (match_id)
                      └── player_game_stats (game_id)

players
  ├── player_aliases (player_id)
  └── league_players (player_id)

gods (standalone lookup table)
```
