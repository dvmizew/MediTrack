/**
 * CSV Export utilities for admin reports and data exports
 */

import { formatRoDate, formatRoTime, formatRoDateTime } from './dateFormat.js';

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

export function generateUsersCSV(users: any[], isAnonymous: boolean = false): string {
	const data = users.map(u => {
		const row: any = {
			'Rol': u.role,
			'Status': u.is_active ? 'Activ' : 'Inactiv',
			'Data Creării': formatRoDate(u.created_at),
		};

		if (isAnonymous) {
			row['ID'] = `USER_${u.user_id}`;
			row['Nume'] = `Utilizator #${u.user_id}`;
		} else {
			row['ID'] = u.user_id;
			row['Nume'] = u.full_name;
			row['Email'] = u.email;
		}

		return row;
	});

	return arrayToCSV(data);
}

export function generateTreatmentsCSV(treatments: any[], isAnonymous: boolean = false): string {
	const data = treatments.map(t => {
		const row: any = {
			'Diagnostic': t.diagnosis || t.diagnoza,
			'Status': (t.is_active ?? t.activ) ? 'Activ' : 'Inactiv',
		'Data Creare': formatRoDate(t.created_at || t.data_criere),
			'Medicamente': t.total_doses || t.medication_count || 0,
		};

		if (isAnonymous) {
			row['ID Plan'] = `PLAN_${t.plan_id}`;
			row['Pacient'] = `Pacient #${t.patient_id}`;
			row['Medic'] = `Medic #${t.doctor_id}`;
		} else {
			row['ID Plan'] = t.plan_id;
			row['Pacient'] = t.patient_name || t.patient_full_name;
			row['Medic'] = t.doctor_name || t.doctor_full_name;
		}

		return row;
	});

	return arrayToCSV(data);
}

export function generateAdherenceCSV(adherenceData: any[], isAnonymous: boolean = false): string {
	const data = adherenceData.map(a => {
		const row: any = {
			'Data': a.date || formatRoDate(a.scheduled_time),
			'Medicament': a.medication || a.medication_name,
			'Status': a.taken ? 'Luat' : (a.status === 'pozitiv' ? 'Luat' : 'Neconfirmat'),
			'Ora Programată': a.scheduled_time,
			'Ora Confirmării': a.confirmed_time || a.confirmed_at || '-',
		};

		if (isAnonymous) {
			row['Utilizator'] = `Utilizator #${a.user_id || a.patient_id}`;
		} else {
			row['Utilizator'] = a.full_name || a.patient_name;
		}

		return row;
	});

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
		'Data Creare Cont': formatRoDate(user.created_at),
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
			'Data Creare': formatRoDate(t.data_creare),
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
			'Data Programată': formatRoDate(c.scheduled_for),
			'Rezultat': c.rezultat === 'pozitiv' ? 'Confirmat' : 'Neconfirmat',
			'Data Confirmare': c.timestamp_confirmare ? formatRoDateTime(c.timestamp_confirmare) : '-',
		})));
		sections.push(confirmCSV);
	} else {
		sections.push('Niciun istoric');
	}

	return sections.join('\n');
}
