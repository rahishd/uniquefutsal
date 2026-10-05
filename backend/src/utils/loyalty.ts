export interface LoyaltyMatch {
  date: string;
  duration?: number;
  notes?: string | null;
}

/**
 * Calculates a player's loyalty progress based on their completed matches
 * and the number of free matches they have already claimed or have available.
 * 
 * Logic:
 * - 1 hour of playtime = 1 point.
 * - Every 10 points redeemed = 1 free match.
 * - Points must be accumulated within a 5-month sliding window to be eligible for a free match.
 * - If a player reaches 10 points but it took > 5 months, their progress caps at 9 until they
 *   complete a new 10-match streak within a 5-month window.
 */
export function calculateLoyaltyProgress(
  matches: LoyaltyMatch[],
  freeMatchesAvailable: number
): { loyaltyCount: number; isEligible: boolean } {
  let freeMatchesRedeemed = 0;
  let totalLoyaltyPoints = 0;

  // Count redeemed matches and total points
  for (const m of matches) {
    if (m.notes?.includes("FREE_MATCH")) {
      freeMatchesRedeemed++;
    } else {
      totalLoyaltyPoints += m.duration || 1;
    }
  }

  const totalFreeMatchesAccounted = freeMatchesRedeemed + (freeMatchesAvailable || 0);
  const effectivePoints = Math.max(0, totalLoyaltyPoints - totalFreeMatchesAccounted * 10);

  if (effectivePoints === 0) {
    return { loyaltyCount: 0, isEligible: false };
  }

  // Collect the dates of the most recent `effectivePoints` (newest to oldest)
  const unredeemedDates: Date[] = [];
  let collected = 0;

  for (const m of matches) {
    if (m.notes?.includes("FREE_MATCH")) continue;
    
    const duration = m.duration || 1;
    for (let i = 0; i < duration; i++) {
      if (collected < effectivePoints) {
        unredeemedDates.push(new Date(m.date));
        collected++;
      }
    }
    if (collected >= effectivePoints) break;
  }

  if (effectivePoints >= 10 && unredeemedDates.length >= 10) {
    const newestDate = unredeemedDates[0];
    const tenthDate = unredeemedDates[9];

    const diffMs = newestDate.getTime() - tenthDate.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);

    if (diffMonths <= 5) {
      return { loyaltyCount: 10, isEligible: true };
    } else {
      // The 10 points took longer than 5 months. Cap at 9.
      return { loyaltyCount: 9, isEligible: false };
    }
  }

  return { loyaltyCount: effectivePoints, isEligible: false };
}
