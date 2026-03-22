-- Update challenge descriptions to reflect unique-counterparty counting.
-- trades_completed now counts distinct trading partners.
-- marketplace_sold counts distinct buyers.
-- marketplace_bought counts distinct sellers.

-- ═══ One-time: trades_completed ═══
UPDATE challenges SET description = 'Complete your first trade' WHERE title = 'First Deal';
UPDATE challenges SET description = 'Trade with 5 different players' WHERE title = 'Trade Regular';
UPDATE challenges SET description = 'Trade with 10 different players' WHERE title = 'Trading Floor';
UPDATE challenges SET description = 'Trade with 25 different players' WHERE title = 'Deal Maker';
UPDATE challenges SET description = 'Trade with 50 different players' WHERE title = 'Trade Empire';
UPDATE challenges SET description = 'Trade with 100 different players' WHERE title = 'Trade Mogul';
UPDATE challenges SET description = 'Trade with 250 different players' WHERE title = 'Trade Tycoon';

-- ═══ One-time: marketplace_sold ═══
UPDATE challenges SET description = 'Sell a card on the marketplace' WHERE title = 'First Listing';
UPDATE challenges SET description = 'Sell to 5 different buyers on the marketplace' WHERE title = 'Market Seller' AND category = 'vault';
UPDATE challenges SET description = 'Sell to 15 different buyers on the marketplace' WHERE title = 'Shopkeeper';
UPDATE challenges SET description = 'Sell to 30 different buyers on the marketplace' WHERE title = 'Market Mogul' AND category = 'vault';
UPDATE challenges SET description = 'Sell to 75 different buyers on the marketplace' WHERE title = 'Market Veteran';
UPDATE challenges SET description = 'Sell to 150 different buyers on the marketplace' WHERE title = 'Market Kingpin';
UPDATE challenges SET description = 'Sell to 300 different buyers on the marketplace' WHERE title = 'Market Overlord';

-- ═══ One-time: marketplace_bought ═══
UPDATE challenges SET description = 'Buy a card from the marketplace' WHERE title = 'Window Shopper';
UPDATE challenges SET description = 'Buy from 5 different sellers on the marketplace' WHERE title = 'Bargain Hunter';
UPDATE challenges SET description = 'Buy from 15 different sellers on the marketplace' WHERE title = 'Shopping Spree';
UPDATE challenges SET description = 'Buy from 30 different sellers on the marketplace' WHERE title = 'Bulk Buyer';
UPDATE challenges SET description = 'Buy from 75 different sellers on the marketplace' WHERE title = 'Market Whale';
UPDATE challenges SET description = 'Buy from 150 different sellers on the marketplace' WHERE title = 'Compulsive Buyer';
UPDATE challenges SET description = 'Buy from 300 different sellers on the marketplace' WHERE title = 'Market Addict';

-- ═══ Rotating: trades_completed ═══
UPDATE cc_challenge_templates SET description = 'Trade with 2 different players today' WHERE title = 'Trade for Packs';
UPDATE cc_challenge_templates SET description = 'Trade with 5 different players this week' WHERE title = 'Trade Master';
UPDATE cc_challenge_templates SET description = 'Trade with 15 different players this month' WHERE title = 'Trading Empire';

-- ═══ Rotating: marketplace_sold ═══
UPDATE cc_challenge_templates SET description = 'Sell to 3 different buyers on the marketplace' WHERE title = 'Market Seller';
UPDATE cc_challenge_templates SET description = 'Sell to 12 different buyers this week' WHERE title = 'Marketplace Regular';
UPDATE cc_challenge_templates SET description = 'Sell to 40 different buyers this month' WHERE title = 'Market Mogul';
