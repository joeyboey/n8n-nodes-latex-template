import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import * as path from 'path';

import { LatexTemplateProcessor } from './LatexTemplateProcessor';
import { getTemplateFields } from './methods/resourceMapping';

export class LatexTemplate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LaTeX Template',
		name: 'latexTemplate',
		icon: { light: 'file:latextemplate.svg', dark: 'file:latextemplate.dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Fill LaTeX templates by replacing \\newcommand variable definitions',
		defaults: {
			name: 'LaTeX Template',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Template File Path',
				name: 'templatePath',
				type: 'string',
				default: '',
				required: true,
				placeholder: '/path/to/invoice-template.tex',
				description: 'Path to the LaTeX template file containing \\newcommand definitions',
				hint: 'Template variables will be auto-discovered and shown below for mapping',
			},
			{
				displayName: 'Template Variables',
				name: 'templateVariables',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					resourceMapper: {
						resourceMapperMethod: 'getTemplateFields',
						mode: 'map',
						valuesLabel: 'Variable Values',
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: true,
					},
				},
				description:
					'Map your workflow data to template variables. Use the "Match by Field Name" button to auto-map matching fields.',
			},
			{
				displayName: 'Output File Name',
				name: 'outputFileName',
				type: 'string',
				default: '',
				placeholder: 'invoice-{{$json.invoiceNumber}}.tex',
				description:
					'File name for the filled template. If empty, auto-generates from template name with "-filled" suffix.',
				hint: 'Supports expressions like {{$json.fieldName}}. Use with "Write Binary File" node to save to disk.',
			},
		],
	};

	methods = {
		resourceMapping: {
			getTemplateFields,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// Get template file path
				const templatePath = this.getNodeParameter('templatePath', i) as string;

				// Get mapped variables from resourceMapper
				const mappedVariables = this.getNodeParameter('templateVariables', i) as {
					value?: Record<string, string>;
				};
				const templateData = mappedVariables.value || {};

				// Load and process template from file
				const processor = LatexTemplateProcessor.fromFile(templatePath);
				const filledBuffer = processor.process(templateData);

				// Get output filename (auto-generate if not provided)
				let outputFileName = this.getNodeParameter('outputFileName', i, '') as string;
				if (!outputFileName || outputFileName.trim() === '') {
					// Auto-generate: template-name-filled.tex
					const parsed = path.parse(templatePath);
					outputFileName = `${parsed.name}-filled${parsed.ext}`;
				}

				// Create binary output
				const outputBinary = await this.helpers.prepareBinaryData(
					filledBuffer,
					outputFileName,
					'text/x-tex',
				);

				// Extract template variables for informational output
				const templateVariables = processor.extractVariables();

				// Return result with binary data and metadata
				returnData.push({
					json: {
						success: true,
						templatePath,
						fileName: outputFileName,
						templateVariables: Object.keys(templateVariables),
						variablesReplaced: Object.keys(templateData),
						replacementCount: Object.keys(templateData).length,
						outputSize: filledBuffer.length,
					},
					binary: {
						data: outputBinary,
					},
					pairedItem: i,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: error.message,
						},
						pairedItem: i,
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
