-- Update income challenge descriptions to clarify 50% fill requirement
UPDATE challenges SET description = 'Collect Starting Five income (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 1;
UPDATE challenges SET description = 'Collect Starting Five income 25 times (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 25;
UPDATE challenges SET description = 'Collect Starting Five income 50 times (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 50;
UPDATE challenges SET description = 'Collect Starting Five income 100 times (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 100;
UPDATE challenges SET description = 'Collect Starting Five income 200 times (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 200;
UPDATE challenges SET description = 'Collect Starting Five income 365 times (50%+ full)' WHERE stat_key = 'income_collected' AND target_value = 365;
