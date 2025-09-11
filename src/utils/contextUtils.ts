export class ContextUtils {
	/**
	 * Sanitize context for use as frontmatter key
	 * Converts to lowercase and replaces non-alphanumeric characters with dashes
	 */
	static sanitizeContextKey(context: string): string {
		return context
			.toLowerCase()
			.trim()
			// Replace sequences of non-alphanumeric characters with single dashes
			.replace(/[^a-z0-9]+/g, '-')
			// Remove leading/trailing dashes
			.replace(/^-+|-+$/g, '')
			// Ensure we don't end up with an empty string
			|| 'context';
	}

	/**
	 * Hydrate context key back to human-readable format
	 * Converts dashes back to spaces for display
	 */
	static hydrateContextKey(sanitizedContext: string): string {
		return sanitizedContext.replace(/-/g, ' ');
	}

	/**
	 * Validate that a context string is acceptable
	 */
	static validateContext(context: string): boolean {
		const trimmed = context.trim();
		return trimmed.length > 0 && trimmed.length <= 100; // Reasonable max length
	}

	/**
	 * Convert hydrated context back to sanitized format
	 * (for when user selects from autocomplete or browser)
	 */
	static dehydrateContext(hydratedContext: string): string {
		return this.sanitizeContextKey(hydratedContext);
	}
}
