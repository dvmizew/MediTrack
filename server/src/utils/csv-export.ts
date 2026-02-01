/**
 * CSV Export utilities for admin reports and data exports
 */

export function arrayToCSV(data: any[], headers?: string[]): string {
	if (data.length === 0) return '';

	// Get headers from first object if not provided
	const csvHeaders = headers || Object.keys(data[0]);

	// Escape CSV values
	const escapeCsvValue = (value: any): string => {
		if (value === null || value === undefined) return '';

		const strValue = String(value);
		// If contains comma, newline, or quote, wrap in quotes and escape quotes
		if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
			return `"${strValue.replace(/"/g, '""')}"`;
		}
		return strValue;
	};

	// Build header row
	const headerRow = csvHeaders.map(escapeCsvValue).join(',');

	// Build data rows
	const dataRows = data.map(row =>
		csvHeaders.map(header => escapeCsvValue(row[header])).join(',')
	);

	return [headerRow, ...dataRows].join('\n');
}

export function generateUsersCSV(users: any[]): string {
	const data = users.map(u => ({
		'ID': u.user_id,
		'Nume': u.full_name,
		'Email': u.email,
		'Rol': u.role,
		'Status': u.is_active ? 'Activ' : 'Inactiv',
		'Data Creării': new Date(u.created_at).toLocaleDateString('ro-RO'),
	}));

	return arrayToCSV(data);
}

export function generateTreatmentsCSV(treatments: any[]): string {
	const data = treatments.map(t => ({
		'ID Plan': t.plan_id,
		'Pacient': t.patient_full_name,
		'Medic': t.doctor_full_name,
		'Diagnostic': t.diagnoza,
		'Status': t.activ ? 'Activ' : 'Inactiv',
		'Data Creare': new Date(t.data_creare).toLocaleDateString('ro-RO'),
		'Medicamente': t.medication_count || 0,
	}));

	return arrayToCSV(data);
}

export function generateCollaborationsCSV(collaborations: any[]): string {
	const data = collaborations.map(c => ({
		'Pacient': c.patient_full_name,
		'Medic': c.doctor_full_name,
		'Status': c.status_invitatie,
		'Data': new Date(c.created_at).toLocaleDateString('ro-RO'),
	}));

	return arrayToCSV(data);
}

export function generateAdherenceCSV(adherenceData: any[]): string {
	const data = adherenceData.map(a => ({
		'Utilizator': a.full_name,
		'Data': a.date,
		'Medicament': a.medication,
		'Status': a.taken ? 'Luat' : 'Neconfirmat',
		'Ora Programată': a.scheduled_time,
		'Ora Confirmării': a.confirmed_time || '-',
	}));

	return arrayToCSV(data);
}

export function generateActivityReportCSV(activities: any[]): string {
	const data = activities.map(a => ({
		'Data': new Date(a.timestamp).toLocaleDateString('ro-RO'),
		'Ora': new Date(a.timestamp).toLocaleTimeString('ro-RO'),
		'Utilizator': a.user_name,
		'Activitate': a.activity,
		'Detalii': a.details || '-',
	}));

	return arrayToCSV(data);
}

/**
 * Create a CSV with personally identifiable information (for user data export)
 */
export function generatePersonalDataExportCSV(user: any, treatments: any[], confirmations: any[]): string {
	const sections: string[] = [];

	// User info
	sections.push('INFORMAȚII PERSONALE');
	sections.push('');
	const userInfo = arrayToCSV([{
		'Nume': user.full_name,
		'Email': user.email,
		'Rol': user.role,
		'Data Creare Cont': new Date(user.created_at).toLocaleDateString('ro-RO'),
	}]);
	sections.push(userInfo);

	// Treatments
	sections.push('');
	sections.push('');
	sections.push('PLANURI DE TRATAMENT');
	sections.push('');
	if (treatments.length > 0) {
		const treatmentCSV = arrayToCSV(treatments.map(t => ({
			'Diagnostic': t.diagnoza,
			'Descriere': t.descriere || '-',
			'Status': t.activ ? 'Activ' : 'Inactiv',
			'Data Creare': new Date(t.data_creare).toLocaleDateString('ro-RO'),
		})));
		sections.push(treatmentCSV);
	} else {
		sections.push('Niciun plan de tratament');
	}

	// Confirmations/History
	sections.push('');
	sections.push('');
	sections.push('ISTORIC CONFIRMĂRI MEDICAMENTE');
	sections.push('');
	if (confirmations.length > 0) {
		const confirmCSV = arrayToCSV(confirmations.map(c => ({
			'Medicament': c.medication_name,
			'Data Programată': new Date(c.scheduled_for).toLocaleDateString('ro-RO'),
			'Rezultat': c.rezultat === 'pozitiv' ? 'Confirmat' : 'Neconfirmat',
			'Data Confirmare': c.timestamp_confirmare ? new Date(c.timestamp_confirmare).toLocaleString('ro-RO') : '-',
		})));
		sections.push(confirmCSV);
	} else {
		sections.push('Niciun istoric');
	}

	return sections.join('\n');
}
