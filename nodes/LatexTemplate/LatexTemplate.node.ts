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
				hint: 'Variables will be auto-discovered from the template',
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
				description: 'Map your workflow data to template variables discovered in the LaTeX file',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Output File Name',
						name: 'outputFileName',
						type: 'string',
						default: '',
						placeholder: 'invoice-{{$json.invoiceNumber}}.tex',
						description:
							'File name for output. If empty, uses template filename with "-filled" suffix.',
					},
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryProperty',
						type: 'string',
						default: 'data',
						description: 'Binary property name for the filled template',
					},
				],
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

				// Get options
				const options = this.getNodeParameter('options', i, {}) as {
					outputFileName?: string;
					outputBinaryProperty?: string;
				};

				// Generate output filename
				let outputFileName = options.outputFileName || '';
				if (!outputFileName || outputFileName.trim() === '') {
					// Auto-generate: template-name-filled.tex
					const parsed = path.parse(templatePath);
					outputFileName = `${parsed.name}-filled${parsed.ext}`;
				}

				const outputBinaryProperty = options.outputBinaryProperty || 'data';

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
						[outputBinaryProperty]: outputBinary,
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
