/**
 * LaTeX Template Processor
 * Handles parsing and filling of LaTeX templates with \newcommand definitions
 */

/**
 * Escape special regex characters in strings
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LatexTemplateProcessor {
	private content: string;

	constructor(content: string) {
		this.content = content;
	}

	/**
	 * Create processor from binary buffer
	 * @param buffer - Binary data containing LaTeX template
	 * @returns New LatexTemplateProcessor instance
	 */
	static fromBinary(buffer: Buffer): LatexTemplateProcessor {
		const content = buffer.toString('utf-8');
		return new LatexTemplateProcessor(content);
	}

	/**
	 * Extract all \newcommand variable names and their current values
	 * Pattern: \newcommand{\varname}{varvalue}
	 *
	 * @returns Object with variable names as keys and current values
	 * @example
	 * Template: \newcommand{\name}{John Doe}
	 * Returns: { name: "John Doe" }
	 */
	extractVariables(): Record<string, string> {
		// Match: \newcommand{\varname}{value}
		// Group 1: variable name
		// Group 2: current value
		const regex = /\\newcommand\{\\(\w+)\}\{([^}]*)\}/g;
		const variables: Record<string, string> = {};

		let match;
		while ((match = regex.exec(this.content)) !== null) {
			const varName = match[1];
			const currentValue = match[2];
			variables[varName] = currentValue;
		}

		return variables;
	}

	/**
	 * Replace \newcommand values with provided data
	 *
	 * @param data - Object with variable names as keys and new values
	 * @returns Template content with replaced values
	 *
	 * Behavior:
	 * - Variables in template but not in data: Left unchanged
	 * - Variables in data but not in template: Ignored
	 * - Multiple occurrences of same variable: All replaced
	 *
	 * @example
	 * Template: \newcommand{\price}{400}
	 * Data: { price: "1500" }
	 * Result: \newcommand{\price}{1500}
	 */
	fillTemplate(data: Record<string, string>): string {
		let output = this.content;

		for (const [varName, newValue] of Object.entries(data)) {
			// Match: \newcommand{\varname}{anything}
			// Replace with: \newcommand{\varname}{newValue}
			const regex = new RegExp(`\\\\newcommand\\{\\\\${escapeRegex(varName)}\\}\\{[^}]*\\}`, 'g');
			const replacement = `\\newcommand{\\${varName}}{${newValue}}`;
			output = output.replace(regex, replacement);
		}

		return output;
	}

	/**
	 * Convert filled template content back to binary buffer
	 * @param content - Filled template content
	 * @returns Buffer ready for n8n binary output
	 */
	toBuffer(content: string): Buffer {
		return Buffer.from(content, 'utf-8');
	}

	/**
	 * Complete processing: fill template and return as buffer
	 * @param data - Variable mappings
	 * @returns Buffer with filled template
	 */
	process(data: Record<string, string>): Buffer {
		const filled = this.fillTemplate(data);
		return this.toBuffer(filled);
	}
}
