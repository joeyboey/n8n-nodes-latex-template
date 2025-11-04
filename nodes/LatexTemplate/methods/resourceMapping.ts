import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';
import { LatexTemplateProcessor } from '../LatexTemplateProcessor';

/**
 * Extract LaTeX template fields for resource mapping
 * Discovers both \newcommand variables and REPEAT_ROW array sections
 */
export async function getTemplateFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const templatePath = this.getNodeParameter('templatePath') as string;

	if (!templatePath || templatePath.trim() === '') {
		return { fields: [] };
	}

	try {
		const processor = LatexTemplateProcessor.fromFile(templatePath);

		// Extract regular \newcommand variables
		const variables = processor.extractVariables();
		const regularFields = Object.entries(variables).map(([varName, currentValue]) => ({
			id: varName,
			displayName: varName,
			required: false,
			defaultMatch: false,
			display: true,
			type: 'string' as const,
			readOnly: false,
			removed: false,
			description: `Current: ${currentValue}`,
		}));

		// Extract repeating sections (arrays)
		const repeatSections = processor.extractRepeatingSections();
		const arrayFields = Object.entries(repeatSections).map(([sectionName, fields]) => ({
			id: sectionName,
			displayName: `${sectionName} (Array)`,
			required: false,
			defaultMatch: false,
			display: true,
			type: 'array' as const,
			readOnly: false,
			removed: false,
			description: `Array with fields: ${fields.join(', ')}. Map with expression: {{$json.${sectionName}}}`,
		}));

		// Combine both types: regular variables first, then arrays
		return { fields: [...regularFields, ...arrayFields] };
	} catch {
		// If template file can't be read, return empty fields
		// This allows user to correct the path without breaking the UI
		return { fields: [] };
	}
}
