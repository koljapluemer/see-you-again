export interface FuzzyResult<T> {
	item: T;
	score: number;
}

export class FuzzySearch {
	/**
	 * Calculate fuzzy search score for a query against text
	 */
	static score(query: string, text: string): number {
		const normalizedQuery = query.toLowerCase();
		const normalizedText = text.toLowerCase();

		if (normalizedText.includes(normalizedQuery)) {
			// Exact substring match gets high score
			return 100 + (50 - normalizedQuery.length);
		}

		// Fuzzy matching: check if all query characters appear in order
		let queryIndex = 0;
		let score = 0;
		
		for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
			if (normalizedText[i] === normalizedQuery[queryIndex]) {
				queryIndex++;
				score += 10;
				
				// Bonus for word boundaries
				if (i === 0 || normalizedText[i - 1] === ' ') {
					score += 5;
				}
			}
		}

		return queryIndex === normalizedQuery.length ? score : 0;
	}

	/**
	 * Filter array of items using fuzzy search
	 */
	static filter<T>(
		items: T[], 
		query: string, 
		textExtractor: (item: T) => string,
		maxResults?: number
	): T[] {
		if (!query.trim()) {
			return (maxResults !== undefined && maxResults > 0) ? items.slice(0, maxResults) : items;
		}

		const results = this.filterWithScores(items, query, textExtractor);
		const filtered = results.map(result => result.item);
		
		return (maxResults !== undefined && maxResults > 0) ? filtered.slice(0, maxResults) : filtered;
	}

	/**
	 * Filter array of items using fuzzy search and return with scores
	 */
	static filterWithScores<T>(
		items: T[], 
		query: string, 
		textExtractor: (item: T) => string
	): FuzzyResult<T>[] {
		if (!query.trim()) {
			return items.map(item => ({ item, score: 0 }));
		}

		return items
			.map(item => ({
				item,
				score: this.score(query, textExtractor(item))
			}))
			.filter(result => result.score > 0)
			.sort((a, b) => b.score - a.score);
	}

	/**
	 * Simple fuzzy filter for string arrays
	 */
	static filterStrings(strings: string[], query: string, maxResults?: number): string[] {
		return this.filter(strings, query, (str) => str, maxResults);
	}

	/**
	 * Check if query matches text using fuzzy logic
	 */
	static matches(query: string, text: string): boolean {
		return this.score(query, text) > 0;
	}
}
