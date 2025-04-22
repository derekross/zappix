/**
 * Formats a number of satoshis into a more readable string (e.g., 1k, 2.1M).
 * Returns an empty string for invalid inputs (NaN, <= 0).
 *
 * @param amount The number of satoshis.
 * @returns A formatted string representation of the satoshi amount.
 */
export const formatSats = (amount: number): string => {
  if (isNaN(amount) || amount <= 0) return ""; // Return empty for invalid amounts

  if (amount < 1000) {
    return amount.toString(); // Show exact amount for less than 1k
  }

  if (amount < 1000000) {
    // Show with 'k' suffix, optional decimal if not a round thousand
    return (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k";
  }

  // Show with 'M' suffix for millions
  return (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "M";
};

// You can add other formatting utility functions here later if needed
// export const anotherFormatFunction = (...) => { ... };
