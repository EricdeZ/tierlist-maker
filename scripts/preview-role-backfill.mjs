#!/usr/bin/env node
/**
 * Preview role backfill — shows what would change, then optionally applies.
 *
 * Usage:
 *   node --env-file=.dev.vars scripts/preview-role-backfill.mjs          # preview only
 *   node --env-file=.dev.vars scripts/preview-role-backfill.mjs --apply  # preview + apply
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const apply = process.argv.includes('--apply')

async function main() {
  console.log('  Querying role diffs...\n')

  // Single query: compute majority role per league_player from game history,
  // then compare against current league_players.role and cc_player_defs.role
  const diffs = await sql`
    WITH role_counts AS (
      SELECT
        pgs.league_player_id,
        LOWER(pgs.role_played) AS role,
        COUNT(*)::int AS games,
        MAX(g.id) AS last_game_id
      FROM player_game_stats pgs
      JOIN games g ON g.id = pgs.game_id
      WHERE pgs.role_played IS NOT NULL
      GROUP BY pgs.league_player_id, LOWER(pgs.role_played)
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY league_player_id ORDER BY games DESC, last_game_id DESC) AS rn
      FROM role_counts
    ),
    computed AS (
      SELECT
        league_player_id,
        MAX(CASE WHEN rn = 1 THEN role END) AS calc_role,
        MAX(CASE WHEN rn = 2 THEN role END) AS calc_secondary
      FROM ranked
      WHERE rn <= 2
      GROUP BY league_player_id
    )
    SELECT
      p.name AS player_name,
      t.name AS team_name,
      s.name AS season_name,
      lp.id AS lp_id,
      lp.role AS lp_role,
      c.calc_role,
      c.calc_secondary,
      d.id AS def_id,
      d.role AS def_role,
      d.frozen_stats IS NOT NULL AS is_frozen
    FROM computed c
    JOIN league_players lp ON lp.id = c.league_player_id
    JOIN players p ON p.id = lp.player_id
    JOIN teams t ON t.id = lp.team_id
    JOIN seasons s ON s.id = lp.season_id
    LEFT JOIN cc_player_defs d
      ON d.player_id = lp.player_id
      AND d.team_id = lp.team_id
      AND d.season_id = lp.season_id
    WHERE c.calc_role IS DISTINCT FROM lp.role
       OR (d.id IS NOT NULL AND d.frozen_stats IS NULL AND c.calc_role IS DISTINCT FROM d.role)
    ORDER BY s.name, t.name, p.name
  `

  if (!diffs.length) {
    console.log('  No role changes needed — everything is already correct.')
    return
  }

  console.log(`  Found ${diffs.length} role change(s):\n`)
  console.log('  Player              Team                Season        LP Role              Def Role')
  console.log('  ' + '─'.repeat(95))

  for (const r of diffs) {
    const player = r.player_name.padEnd(20)
    const team = r.team_name.padEnd(20)
    const season = r.season_name.padEnd(14)

    const lpChanged = r.calc_role !== r.lp_role
    const lp = lpChanged
      ? `${r.lp_role || '(none)'} -> ${r.calc_role}`.padEnd(21)
      : (r.lp_role || '(none)').padEnd(21)

    let def
    if (!r.def_id) {
      def = '(no def)'
    } else if (r.is_frozen) {
      def = `${r.def_role} (frozen)`
    } else if (r.calc_role !== r.def_role) {
      def = `${r.def_role || '(none)'} -> ${r.calc_role}`
    } else {
      def = r.def_role || '(none)'
    }

    console.log(`  ${player}${team}${season}${lp}${def}`)
  }

  if (!apply) {
    console.log(`\n  Run with --apply to apply these changes.`)
    return
  }

  console.log('\n  Applying...')
  let applied = 0
  for (const r of diffs) {
    await sql`
      UPDATE league_players
      SET role = ${r.calc_role}, secondary_role = ${r.calc_secondary}, updated_at = NOW()
      WHERE id = ${r.lp_id}
    `
    if (r.def_id && !r.is_frozen) {
      await sql`
        UPDATE cc_player_defs
        SET role = ${r.calc_role}, updated_at = NOW()
        WHERE id = ${r.def_id}
      `
      await sql`
        UPDATE cc_cards
        SET role = ${r.calc_role},
            card_data = jsonb_set(COALESCE(card_data, '{}'::jsonb), '{role}', ${JSON.stringify(r.calc_role.toUpperCase())}::jsonb)
        WHERE def_id = ${r.def_id}
        AND card_type = 'player'
      `
    }
    applied++
  }
  console.log(`  Done — ${applied} player(s) updated.`)
}

main().catch(err => { console.error(err); process.exit(1) })
