-- Add cheerleader and staff roles to cc_lineups for Starting 5 staff card slots
ALTER TABLE cc_lineups DROP CONSTRAINT IF EXISTS cc_lineups_role_check;
ALTER TABLE cc_lineups ADD CONSTRAINT cc_lineups_role_check
  CHECK (role IN ('solo', 'jungle', 'mid', 'support', 'adc', 'bench', 'cheerleader', 'staff'));
