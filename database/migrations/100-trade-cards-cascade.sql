-- Add ON DELETE CASCADE to cc_trade_cards.card_id FK
-- Prevents FK violation when deleting cards that were part of trades
ALTER TABLE cc_trade_cards DROP CONSTRAINT cc_trade_cards_card_id_fkey;
ALTER TABLE cc_trade_cards ADD CONSTRAINT cc_trade_cards_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cc_cards(id) ON DELETE CASCADE;
