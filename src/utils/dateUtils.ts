/**
 * Date utilities for handling "human days" where the day changes at 4am instead of midnight
 */
export class DateUtils {
	/**
	 * Get the current "human day" - if it's before 4am, it's still "yesterday"
	 * Returns date in yyyy-mm-dd format
	 */
	static getCurrentHumanDay(): string {
		const now = new Date();
		
		// If it's before 4am, subtract a day to get "yesterday"
		if (now.getHours() < 4) {
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			return this.formatDate(yesterday);
		}
		
		return this.formatDate(now);
	}
	
	/**
	 * Format a Date object to yyyy-mm-dd string
	 */
	static formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
	
	/**
	 * Check if a date string (yyyy-mm-dd) represents today in human-day terms
	 */
	static isToday(dateString: string): boolean {
		const currentHumanDay = this.getCurrentHumanDay();
		return dateString === currentHumanDay;
	}
	
	/**
	 * Check if a date string represents a date before today in human-day terms
	 */
	static isBeforeToday(dateString: string): boolean {
		const currentHumanDay = this.getCurrentHumanDay();
		return dateString < currentHumanDay;
	}
	
	/**
	 * Parse a date string and return if it's valid
	 */
	static isValidDateString(dateString: string): boolean {
		if (!dateString) return false;
		
		// Check format yyyy-mm-dd
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(dateString)) return false;
		
		// Check if it's a valid date
		const date = new Date(dateString + 'T00:00:00');
		return !isNaN(date.getTime()) && dateString === this.formatDate(date);
	}
}