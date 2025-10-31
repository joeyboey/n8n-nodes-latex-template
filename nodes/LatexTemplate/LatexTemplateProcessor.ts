/**
 * LaTeX Template Processor
 * Handles parsing and filling of LaTeX templates with \newcommand definitions
 */

import * as fs from 'fs';

/**
 * Escape special regex characters in variable names
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
	 * Create processor from file path
	 * @param filePath - Path to LaTeX template file
	 * @returns New LatexTemplateProcessor instance
	 * @throws Error if file cannot be read
	 */
	static fromFile(filePath: string): LatexTemplateProcessor {
		const content = fs.readFileSync(filePath, 'utf-8');
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
		const regex = /\\newcommand\{\\(\w+)\}\{([^}]*)\}/g;
		const variables: Record<string, string> = {};

		let match;
		while ((match = regex.exec(this.content)) !== null) {
			const [, varName, currentValue] = match;
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
			const regex = new RegExp(`\\\\newcommand\\{\\\\${escapeRegex(varName)}\\}\\{[^}]*\\}`, 'g');
			const replacement = `\\newcommand{\\${varName}}{${newValue}}`;
			output = output.replace(regex, replacement);
		}

		return output;
	}

	/**
	 * Complete processing: fill template and return as buffer
	 * @param data - Variable mappings
	 * @returns Buffer with filled template ready for binary output
	 */
	process(data: Record<string, string>): Buffer {
		const filled = this.fillTemplate(data);
		return Buffer.from(filled, 'utf-8');
	}
}
