-- Allow referral_fuel in spark_transactions type constraint
ALTER TABLE spark_transactions DROP CONSTRAINT IF EXISTS spark_transactions_type_check;
ALTER TABLE spark_transactions ADD CONSTRAINT spark_transactions_type_check
    CHECK (type IN ('fuel', 'cool', 'liquidate', 'tutorial_fuel', 'referral_fuel'));
