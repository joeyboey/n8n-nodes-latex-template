/**
 * LaTeX Template Processor
 * Handles parsing and filling of LaTeX templates with \newcommand definitions
 * Supports repeating sections for dynamic table rows and lists
 */

import * as fs from 'fs';

/**
 * Escape LaTeX special characters in text values
 * Applied to ALL variable replacements to prevent compilation errors
 *
 * @param value - Any value to escape (string, number, boolean, etc.)
 * @returns Escaped string safe for LaTeX
 */
function escapeLaTeX(value: string | number | boolean | null | undefined): string {
	// Handle non-string types
	if (value === null || value === undefined) return '';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';

	const str = String(value);

	// Escape LaTeX special characters in order
	// Backslash MUST be first to avoid double-escaping
	return str
		.replace(/\\/g, '\\textbackslash{}')
		.replace(/&/g, '\\&')
		.replace(/%/g, '\\%')
		.replace(/\$/g, '\\$')
		.replace(/#/g, '\\#')
		.replace(/_/g, '\\_')
		.replace(/\{/g, '\\{')
		.replace(/\}/g, '\\}')
		.replace(/~/g, '\\textasciitilde{}')
		.replace(/\^/g, '\\textasciicircum{}');
}

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
	 * Extract repeating section definitions from template
	 * Pattern: % REPEAT_ROW(sectionName) $VAR_* placeholders
	 *
	 * @returns Object with section names and their required fields
	 * @example
	 * Template: % REPEAT_ROW(invoiceItems) $VAR_POS. & $VAR_DATE & $VAR_DESC \\
	 * Returns: { invoiceItems: ['date', 'desc'] }
	 */
	extractRepeatingSections(): Record<string, string[]> {
		const sections: Record<string, string[]> = {};

		// Find all REPEAT_ROW(name) lines
		const repeatRegex = /%\s*REPEAT_ROW\(([^)]+)\)\s*(.+)/g;
		const matches = [...this.content.matchAll(repeatRegex)];

		for (const match of matches) {
			const sectionName = match[1]; // e.g., "invoiceItems"
			const rowTemplate = match[2]; // Template with $VAR_* placeholders

			// Extract all $VAR_* placeholders
			const varPattern = /\$VAR_(\w+)/g;
			const varMatches = [...rowTemplate.matchAll(varPattern)];

			const fields: string[] = [];
			for (const varMatch of varMatches) {
				const varName = varMatch[1]; // e.g., "POS_DATE"

				// Convert to item property name
				const fieldName = varName.toLowerCase();

				// Add if not duplicate
				if (!fields.includes(fieldName)) {
					fields.push(fieldName);
				}
			}

			sections[sectionName] = fields;
		}

		return sections;
	}

	/**
	 * Process named repeating row sections
	 * Pattern: % REPEAT_ROW(sectionName) template with $VAR_* placeholders
	 *
	 * @param repeatData - Object with section names as keys, arrays as values
	 * @returns Template with repeated sections filled and uncommented
	 *
	 * @example
	 * Template: % REPEAT_ROW(items) $VAR_POS. & $VAR_NAME \\
	 * Data: { items: [{name: "A"}, {name: "B"}] }
	 * Result: 1. & A \\
	 *         2. & B \\
	 */
	processRepeatingRows(repeatData: Record<string, Array<Record<string, unknown>>>): string {
		let output = this.content;

		// Find all REPEAT_ROW(name) lines
		const repeatRegex = /%\s*REPEAT_ROW\(([^)]+)\)\s*(.+)/g;
		const matches = [...this.content.matchAll(repeatRegex)];

		for (const match of matches) {
			const fullLine = match[0]; // Full commented line
			const sectionName = match[1]; // e.g., "invoiceItems"
			const rowTemplate = match[2]; // Template without % REPEAT_ROW(...)

			const items = repeatData[sectionName] || [];

			if (items.length === 0) {
				// No items: remove the REPEAT_ROW line entirely
				output = output.replace(fullLine + '\n', '');
				continue;
			}

			// Generate rows for each item
			let generatedRows = '';

			items.forEach((item) => {
				let row = rowTemplate;

				// Find all $VAR_* placeholders in template
				const varPattern = /\$VAR_(\w+)/g;
				const varMatches = [...rowTemplate.matchAll(varPattern)];

				for (const varMatch of varMatches) {
					const placeholder = varMatch[0]; // $VAR_POS_DATE
					const varName = varMatch[1]; // POS_DATE

					// Map variable name directly to item property (lowercase)
					const itemKey = varName.toLowerCase();
					const rawValue = item[itemKey];

					// Escape for LaTeX
					const value = escapeLaTeX(rawValue as string | number | boolean | null | undefined);

					// Replace placeholder with escaped value
					row = row.replace(placeholder, value);
				}

				generatedRows += row + '\n';
			});

			// Replace the commented template line with generated rows
			output = output.replace(fullLine + '\n', generatedRows);
		}

		return output;
	}

	/**
	 * Replace \newcommand values with provided data
	 * ALL values are escaped for LaTeX safety
	 *
	 * @param data - Object with variable names as keys and new values
	 * @returns Template content with replaced values
	 *
	 * Behavior:
	 * - Variables in template but not in data: Left unchanged
	 * - Variables in data but not in template: Ignored
	 * - All values are escaped for LaTeX special characters
	 * - Arrays are skipped (handled by processRepeatingRows)
	 *
	 * @example
	 * Template: \newcommand{\company}{Default}
	 * Data: { company: "Müller & Söhne" }
	 * Result: \newcommand{\company}{Müller \& Söhne}
	 */
	fillTemplate(data: Record<string, unknown>): string {
		let output = this.content;

		for (const [varName, rawValue] of Object.entries(data)) {
			// Skip arrays (handled by processRepeatingRows)
			if (Array.isArray(rawValue)) {
				continue;
			}

			// Escape value for LaTeX (assert type)
			const escapedValue = escapeLaTeX(rawValue as string | number | boolean | null | undefined);

			const regex = new RegExp(`\\\\newcommand\\{\\\\${escapeRegex(varName)}\\}\\{[^}]*\\}`, 'g');
			const replacement = `\\newcommand{\\${varName}}{${escapedValue}}`;
			output = output.replace(regex, replacement);
		}

		return output;
	}

	/**
	 * Complete processing: repeating sections + variable replacement
	 *
	 * @param data - All template data (variables + arrays)
	 * Arrays are automatically detected and processed as repeating sections
	 * Regular values are escaped and used for \newcommand replacements
	 *
	 * @returns Buffer with filled template ready for binary output
	 *
	 * @example
	 * Data: {
	 *   name: "Company",
	 *   invoiceItems: [{description: "Item 1", price: 100}]
	 * }
	 * - invoiceItems array → processed as REPEAT_ROW(invoiceItems)
	 * - name → replaced in \newcommand{\name}{...}
	 */
	process(data: Record<string, unknown>): Buffer {
		// 1. Separate arrays from regular variables
		const repeatSections: Record<string, Array<Record<string, unknown>>> = {};
		const regularVars: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
			// Check if it's an array
			if (Array.isArray(value)) {
				repeatSections[key] = value;
			}
			// Check if it's a JSON string that might be an array
			else if (typeof value === 'string' && value.trim().startsWith('[')) {
				try {
					const parsed = JSON.parse(value);
					if (Array.isArray(parsed)) {
						repeatSections[key] = parsed;
					} else {
						regularVars[key] = value;
					}
				} catch {
					// Not valid JSON, treat as regular string
					regularVars[key] = value;
				}
			}
			// Regular variable
			else {
				regularVars[key] = value;
			}
		}

		let output = this.content;

		// 2. Process repeating sections first (if any)
		if (Object.keys(repeatSections).length > 0) {
			const processor = new LatexTemplateProcessor(output);
			output = processor.processRepeatingRows(repeatSections);
		}

		// 3. Fill regular variables (with escaping)
		const finalProcessor = new LatexTemplateProcessor(output);
		const filled = finalProcessor.fillTemplate(regularVars);

		return Buffer.from(filled, 'utf-8');
	}
}
