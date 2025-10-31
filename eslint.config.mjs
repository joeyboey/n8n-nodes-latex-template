import { config } from '@n8n/node-cli/eslint';

// This is a SELF-HOSTED node that requires file system access
// It is NOT compatible with n8n Cloud and needs fs/path for LaTeX template processing
export default [
	...config,
	{
		// Allow file system operations for self-hosted deployment
		rules: {
			// Allow fs and path imports for template file reading
			'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
			'import/no-extraneous-dependencies': 'off',
			'@n8n/community-nodes/no-restricted-imports': 'off',
			'@n8n/community-nodes/no-credential-reuse': 'off',
		},
	},
	{
		// Methods can use any Node.js APIs
		files: ['nodes/**/methods/**/*.ts'],
		rules: {
			'import/no-extraneous-dependencies': 'off',
		},
	},
];
