// Marketplace and trading logic

import { MARKETPLACE, TRADING, RARITIES } from '../../../data/cardclash/economy';

// List a card on the marketplace
export function createListing(card, price, sellerId) {
  if (price <= 0) return { error: 'Price must be positive' };
  if (!card) return { error: 'Card not found' };

  const fee = Math.ceil(price * MARKETPLACE.listingFeePercent / 100);
  const sellerReceives = price - fee;

  return {
    cardId: card.id,
    sellerId,
    price,
    fee,
    sellerReceives,
    listedAt: Date.now(),
    expiresAt: Date.now() + MARKETPLACE.listingDurationDays * 24 * 60 * 60 * 1000,
    status: 'active',
  };
}

// Buy a listed card
export function executePurchase(listing, buyerId, buyerBalance) {
  if (listing.status !== 'active') return { error: 'Listing no longer active' };
  if (buyerId === listing.sellerId) return { error: 'Cannot buy your own listing' };
  if (buyerBalance < listing.price) return { error: 'Insufficient Passion' };
  if (Date.now() > listing.expiresAt) return { error: 'Listing expired' };

  return {
    success: true,
    buyerId,
    sellerId: listing.sellerId,
    cardId: listing.cardId,
    price: listing.price,
    fee: listing.fee,
    sellerReceives: listing.sellerReceives,
    soldAt: Date.now(),
  };
}

// Create a trade offer
export function createTradeOffer(offererId, receiverId, offererCards, receiverCards, offererPassion = 0, receiverPassion = 0) {
  const errors = [];

  if (offererId === receiverId) errors.push('Cannot trade with yourself');
  if (offererCards.length > TRADING.maxCardsPerSide) errors.push(`Max ${TRADING.maxCardsPerSide} cards per side`);
  if (receiverCards.length > TRADING.maxCardsPerSide) errors.push(`Max ${TRADING.maxCardsPerSide} cards per side`);
  if (offererPassion > TRADING.maxPassionPerSide) errors.push(`Max ${TRADING.maxPassionPerSide} Passion per side`);
  if (receiverPassion > TRADING.maxPassionPerSide) errors.push(`Max ${TRADING.maxPassionPerSide} Passion per side`);
  if (offererCards.length === 0 && receiverCards.length === 0 && offererPassion === 0 && receiverPassion === 0) {
    errors.push('Trade must include at least one card or Passion');
  }

  if (errors.length > 0) return { error: errors.join(', ') };

  return {
    offererId,
    receiverId,
    offererCards,
    receiverCards,
    offererPassion,
    receiverPassion,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + TRADING.expiryHours * 60 * 60 * 1000,
  };
}

// Disenchant a card into Embers
export function disenchantCard(card) {
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common;
  return {
    cardId: card.id,
    embersGained: rarityInfo.emberValue,
    rarity: card.rarity,
  };
}

// Craft a new card
export function craftCard(rarity, isTargeted = false) {
  const rarityInfo = RARITIES[rarity];
  if (!rarityInfo) return { error: 'Unknown rarity' };

  const cost = isTargeted ? rarityInfo.targetedCraftCost : rarityInfo.craftCost;

  return {
    rarity,
    isTargeted,
    embersCost: cost,
  };
}

// Upgrade a card (3 copies + embers → higher rarity)
export function upgradeCard(card, copies) {
  if (copies.length < 3) return { error: 'Need 3 copies to upgrade' };

  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const currentIndex = rarityOrder.indexOf(card.rarity);

  if (currentIndex >= rarityOrder.length - 1) return { error: 'Already max rarity' };

  const targetRarity = rarityOrder[currentIndex + 1];
  const targetInfo = RARITIES[targetRarity];

  return {
    fromRarity: card.rarity,
    toRarity: targetRarity,
    copiesConsumed: 3,
    embersCost: targetInfo.craftCost,
    powerBonus: 5,
  };
}

// Estimate market value based on rarity + power
export function estimateValue(card) {
  const rarityInfo = RARITIES[card.rarity] || RARITIES.common;
  const baseValue = rarityInfo.craftCost; // craft cost as baseline
  const powerMultiplier = 0.5 + (card.power / 100);
  const levelMultiplier = 1 + (card.level - 1) * 0.1;

  return Math.round(baseValue * powerMultiplier * levelMultiplier);
}

export default {
  createListing,
  executePurchase,
  createTradeOffer,
  disenchantCard,
  craftCard,
  upgradeCard,
  estimateValue,
};
