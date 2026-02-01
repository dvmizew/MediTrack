/**
 * CSV utility functions for report generation
 */

/**
 * Generate CSV string from headers and rows
 * Properly escapes commas, quotes, and newlines
 */
export function generateCSV(headers: string[], rows: any[]): string {
	const csvHeaders = headers.join(',');
	const csvRows = rows.map(row => 
		headers.map(header => {
			const value = row[header];
			if (value === null || value === undefined) return '';
			const stringValue = String(value);
			// Escape quotes and wrap in quotes if contains comma or quotes
			if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
				return `"${stringValue.replace(/"/g, '""')}"`;
			}
			return stringValue;
		}).join(',')
	).join('\n');
	
	return `${csvHeaders}\n${csvRows}`;
}
