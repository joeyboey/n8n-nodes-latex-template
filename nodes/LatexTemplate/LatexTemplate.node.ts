import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { LatexTemplateProcessor } from './LatexTemplateProcessor';

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
				displayName: 'Input Binary Property',
				name: 'binaryProperty',
				type: 'string',
				default: 'data',
				required: true,
				placeholder: 'data',
				description: 'Name of the binary property containing the LaTeX template file',
				hint: 'Use "Read Binary File" node before this to load your template',
			},
			{
				displayName: 'Variable Mappings',
				name: 'mappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Variable',
				},
				default: {},
				placeholder: 'Add Variable Mapping',
				description: 'Map your workflow data to LaTeX template variables',
				options: [
					{
						name: 'mapping',
						displayName: 'Mapping',
						values: [
							{
								displayName: 'Variable Name',
								name: 'variable',
								type: 'string',
								default: '',
								required: true,
								placeholder: 'invoiceNumber',
								description: 'LaTeX variable name from \\newcommand definition',
								hint: 'Example: For \\newcommand{\\price}{400}, use "price"',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: '={{$json.number}}',
								description: 'New value to set (supports n8n expressions)',
								hint: 'Use ={{$json.fieldName}} to reference input data',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Output Binary Property',
						name: 'outputBinaryProperty',
						type: 'string',
						default: 'data',
						description: 'Name of the binary property to store the filled template',
					},
					{
						displayName: 'Output File Name',
						name: 'outputFileName',
						type: 'string',
						default: 'filled-template.tex',
						placeholder: 'invoice-{{$json.invoiceNumber}}.tex',
						description: 'File name for the output (supports expressions)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// Get input binary property name
				const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;

				// Assert binary data exists
				this.helpers.assertBinaryData(i, binaryProperty);

				// Get binary buffer
				const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);

				// Get variable mappings from UI
				const mappingsParam = this.getNodeParameter('mappings', i, {}) as {
					mapping?: Array<{ variable: string; value: string }>;
				};
				const mappings = mappingsParam.mapping || [];

				// Convert mappings array to object for processor
				const templateData: Record<string, string> = {};
				for (const m of mappings) {
					if (m.variable && m.value !== undefined && m.value !== '') {
						templateData[m.variable] = String(m.value);
					}
				}

				// Process template
				const processor = LatexTemplateProcessor.fromBinary(buffer);
				const filledBuffer = processor.process(templateData);

				// Get options
				const options = this.getNodeParameter('options', i, {}) as {
					outputBinaryProperty?: string;
					outputFileName?: string;
				};
				const outputBinaryProperty = options.outputBinaryProperty || 'data';
				const outputFileName = options.outputFileName || 'filled-template.tex';

				// Create output binary data
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
						fileName: outputFileName,
						templateVariables: Object.keys(templateVariables),
						variablesReplaced: Object.keys(templateData),
						replacementCount: Object.keys(templateData).length,
						templateSize: buffer.length,
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
