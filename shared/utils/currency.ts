/**
 * Format a number for display as EUR (label only; underlying values remain the same).
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with EUR currency
 */
export function formatRON(amount: number, decimals: number = 2): string {
	return `${amount.toFixed(decimals)} EUR`;
}

/**
 * Format a number as EUR with thousand separators (display only).
 * @param amount - The amount to format
 * @returns Formatted string with EUR currency
 */
export function formatRONWithSeparators(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
		style: 'currency',
		currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse RON string to number
 * @param ronString - String like "100 RON" or "100.50 RON"
 * @returns Parsed number
 */
export function parseRON(ronString: string): number {
  return parseFloat(ronString.replace(/[^\d.]/g, ''));
}
