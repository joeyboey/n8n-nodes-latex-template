# n8n-nodes-latex-template

This node fills LaTeX templates by replacing `\newcommand` variable definitions with data from n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)  
[How It Works](#how-it-works)  
[Template Format](#template-format)  
[Usage](#usage)  
[Node Properties](#node-properties)  
[Output](#output)  
[Workflow Example](#workflow-example)  
[Compatibility](#compatibility)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## How It Works

The LaTeX Template node reads a LaTeX template file from the file system, extracts variable definitions in the format `\newcommand{\varname}{value}`, and replaces their values with data from the workflow. The filled template is returned as binary data.

The node uses n8n's resource mapper to auto-discover variables in the template, allowing visual mapping between workflow data and template variables.

## Template Format

Templates must use `\newcommand` for variable definitions:

```latex
% Invoice template example
\documentclass{article}

% Company information
\newcommand{\companyName}{Default Company Name}
\newcommand{\companyAddress}{Default Address}

% Invoice data
\newcommand{\invoiceNumber}{000}
\newcommand{\invoiceDate}{2024-01-01}
\newcommand{\totalAmount}{0.00}

% Client information
\newcommand{\clientName}{Default Client}
\newcommand{\clientAddress}{Default Client Address}

\begin{document}
\textbf{Invoice \invoiceNumber{}}

From: \companyName{}, \companyAddress{}
To: \clientName{}, \clientAddress{}

Date: \invoiceDate{}
Amount: \totalAmount{}
\end{document}
```

The node extracts variable names (`companyName`, `invoiceNumber`, etc.) and displays them in the UI for mapping.

## Usage

### Basic Workflow

1. **Prepare template file** - Create a `.tex` file with `\newcommand` definitions on the file system
2. **Add LaTeX Template node** - Configure template path
3. **Map variables** - Drag workflow data to template variables (auto-discovered)
4. **Add Write Binary File node** - Save the filled template to disk

### Variable Mapping

Variables are mapped using n8n's resource mapper:

- **Auto-discovery**: Enter template path, variables appear automatically
- **Drag-and-drop**: Map workflow data to template variables visually
- **Expressions**: Use n8n expressions like `{{$json.fieldName}}`
- **Auto-map**: Click "Match by Field Name" to auto-map matching field names

### Variable Behavior

- Variables in template but not mapped: Remain unchanged with their original values
- Variables mapped but not in template: Ignored
- Multiple `\newcommand` definitions with same variable name: All replaced

## Node Properties

### Template File Path
**Required**

Path to the LaTeX template file containing `\newcommand` definitions. The file must be accessible from the n8n instance's file system.

Example: `/home/user/templates/invoice-template.tex`

### Template Variables
**Required**

Resource mapper that auto-discovers variables from the template file. Map workflow data to template variables using drag-and-drop or expressions.

Example mappings:
- `invoiceNumber` ← `{{$json.number}}`
- `totalAmount` ← `{{$json.amount}}`
- `clientName` ← `{{$json.client.name}}`

### Output File Name
**Optional**

File name for the filled template in binary output. Supports n8n expressions.

Default behavior: If empty, generates filename as `{template-name}-filled.tex`

Examples:
- `invoice-{{$json.invoiceNumber}}.tex`
- `contract-{{$json.clientId}}-{{$now}}.tex`

## Output

The node returns binary data containing the filled template and metadata in JSON format.

### Binary Output

Binary property `data` contains the filled LaTeX template. Use the Write Binary File node to save it to disk.

### JSON Output

```json
{
  "success": true,
  "templatePath": "/tmp/invoice-template.tex",
  "fileName": "invoice-filled.tex",
  "templateVariables": ["companyName", "invoiceNumber", "totalAmount", "clientName"],
  "variablesReplaced": ["companyName", "invoiceNumber", "totalAmount"],
  "replacementCount": 3,
  "outputSize": 2048
}
```

Fields:
- `success`: Processing status (boolean)
- `templatePath`: Path to source template
- `fileName`: Generated output filename
- `templateVariables`: All variables found in template
- `variablesReplaced`: Variables that were mapped and replaced
- `replacementCount`: Number of variables replaced
- `outputSize`: Size of filled template in bytes

## Workflow Example

### Input Data (Set Node)
```json
{
  "company": "ACME Corporation",
  "invoiceId": "INV-2024-001",
  "amount": "1500.00",
  "clientName": "Wayne Enterprises"
}
```

### LaTeX Template Node Configuration
- **Template Path**: `/home/user/invoice-template.tex`
- **Variable Mappings**:
  - `companyName` → `{{$json.company}}`
  - `invoiceNumber` → `{{$json.invoiceId}}`
  - `totalAmount` → `{{$json.amount}}`
  - `clientName` → `{{$json.clientName}}`

### Write Binary File Node
- **File Path**: `/tmp/invoices/{{$json.invoiceId}}.tex`
- **Binary Property**: `data`

### Result
File created at `/tmp/invoices/INV-2024-001.tex` with:
```latex
\newcommand{\companyName}{ACME Corporation}
\newcommand{\invoiceNumber}{INV-2024-001}
\newcommand{\totalAmount}{1500.00}
\newcommand{\clientName}{Wayne Enterprises}
```

## Compatibility

Requires n8n version 1.0.0 or later.

Tested with:
- n8n 1.x
- Node.js 18.x, 20.x

This is a self-hosted node that requires file system access. It is not compatible with n8n Cloud.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [LaTeX documentation](https://www.latex-project.org/help/documentation/)
* [Write Binary File node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.writebinaryfile/) - Used to save filled templates

## License

[MIT](LICENSE.md)