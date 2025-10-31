import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';
import { LatexTemplateProcessor } from '../LatexTemplateProcessor';

/**
 * Extract LaTeX template variables for resource mapping
 * This method is called when the user enters a template path
 * It reads the template file and discovers all \newcommand variables
 */
export async function getTemplateFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	// Get template path from node parameters
	const templatePath = this.getNodeParameter('templatePath') as string;

	// Return empty if no path provided yet
	if (!templatePath || templatePath.trim() === '') {
		return { fields: [] };
	}

	try {
		// Load template and extract all \newcommand variables
		const processor = LatexTemplateProcessor.fromFile(templatePath);
		const variables = processor.extractVariables();

		// Convert to ResourceMapperFields format
		const fields = Object.entries(variables).map(([varName, currentValue]) => ({
			id: varName,
			displayName: varName,
			required: false,
			defaultMatch: false,
			display: true,
			type: 'string' as const,
			readOnly: false,
			removed: false,
			description: `Current value: ${currentValue}`,
		}));

		return { fields };
	} catch {
		// If template file can't be read, return empty fields
		// This allows user to correct the path without breaking the UI
		return { fields: [] };
	}
}
