/**
 * Chart utility functions using Chart.js
 */
import Chart from 'chart.js/auto';

/**
 * Theme configuration for charts with dark/light mode support
 */
export interface ChartTheme {
	text: string;
	grid: string;
	tooltip: {
		bg: string;
		title: string;
		body: string;
		border: string;
	};
}

/**
 * Get theme colors based on dark mode
 */
export function getChartTheme(isDark: boolean): ChartTheme {
	return {
		text: isDark ? '#d1d5db' : '#374151',
		grid: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.5)',
		tooltip: {
			bg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
			title: isDark ? '#f3f4f6' : '#111827',
			body: isDark ? '#e5e7eb' : '#1f2937',
			border: isDark ? '#4b5563' : '#e5e7eb'
		}
	};
}

export function createPieChart(
	ctx: CanvasRenderingContext2D,
	data: { label: string; value: number }[],
	title?: string
) {
	return new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: data.map(d => d.label),
			datasets: [
				{
					data: data.map(d => d.value),
					backgroundColor: [
						'rgba(59, 130, 246, 0.8)',
						'rgba(34, 197, 94, 0.8)',
						'rgba(239, 68, 68, 0.8)',
						'rgba(168, 85, 247, 0.8)',
						'rgba(249, 115, 22, 0.8)',
					],
					borderColor: ['#ffffff'],
					borderWidth: 2
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					position: 'bottom',
					labels: {
						padding: 15,
						font: { size: 12 }
					}
				},
				title: title ? { display: true, text: title } : undefined
			}
		}
	});
}

export function createBarChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	data: { label: string; data: number[] }[],
	title?: string
) {
	return new Chart(ctx, {
		type: 'bar',
		data: {
			labels,
			datasets: data.map((dataset, idx) => ({
				label: dataset.label,
				data: dataset.data,
				backgroundColor: [
					'rgba(59, 130, 246, 0.8)',
					'rgba(34, 197, 94, 0.8)',
					'rgba(239, 68, 68, 0.8)',
				][idx] || `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.8)`
			}))
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					labels: { padding: 15 }
				},
				title: title ? { display: true, text: title } : undefined
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						stepSize: 1
					}
				}
			}
		}
	});
}

export function createLineChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	data: { label: string; data: number[] }[],
	title?: string
) {
	return new Chart(ctx, {
		type: 'line',
		data: {
			labels,
			datasets: data.map((dataset, idx) => ({
				label: dataset.label,
				data: dataset.data,
				borderColor: [
					'rgb(59, 130, 246)',
					'rgb(34, 197, 94)',
					'rgb(239, 68, 68)',
				][idx] || `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`,
				backgroundColor: `rgba(59, 130, 246, 0.1)`,
				tension: 0.3,
				fill: true,
				pointRadius: 5,
				pointBackgroundColor: 'rgba(59, 130, 246, 1)',
				pointBorderColor: '#fff',
				pointBorderWidth: 2
			}))
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					labels: { padding: 15 }
				},
				title: title ? { display: true, text: title } : undefined
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						stepSize: 1
					}
				}
			}
		}
	});
}

/**
 * Create a doughnut/percentage chart with theme support
 * Used for adherence/compliance visualization
 */
export function createPercentageChart(
	ctx: CanvasRenderingContext2D,
	completed: number,
	total: number,
	labels: [string, string] = ['Completat', 'Rămas'],
	theme?: ChartTheme
) {
	const remaining = total - completed;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
	
	return new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels,
			datasets: [{
				data: [completed, remaining],
				backgroundColor: ['#22c55e', '#f87171'],
				borderWidth: 0
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: {
					position: 'bottom',
					labels: { 
						boxWidth: 12, 
						padding: 8,
						font: { size: 10, weight: 500 },
						color: theme?.text
					}
				},
				tooltip: {
					backgroundColor: theme?.tooltip.bg,
					titleColor: theme?.tooltip.title,
					bodyColor: theme?.tooltip.body,
					borderColor: theme?.tooltip.border,
					borderWidth: 1,
					padding: 10,
					displayColors: true,
					titleFont: { size: 12, weight: 'bold' as const },
					bodyFont: { size: 11 }
				}
			},
			cutout: '70%'
		}
	});
}

/**
 * Create a bar chart with comparative data and theme support
 * Used for scheduled vs confirmed comparisons
 */
export function createComparisonBarChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	datasets: { label: string; data: number[] }[],
	theme?: ChartTheme,
	maxValue?: number
) {
	return new Chart(ctx, {
		type: 'bar',
		data: {
			labels,
			datasets: datasets.map((ds, idx) => ({
				label: ds.label,
				data: ds.data,
				backgroundColor: ['#60a5fa', '#34d399'][idx] || '#8b5cf6',
				borderRadius: 4,
				borderSkipped: false
			}))
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			plugins: {
				legend: { display: datasets.length > 1 },
				tooltip: {
					backgroundColor: theme?.tooltip.bg,
					titleColor: theme?.tooltip.title,
					bodyColor: theme?.tooltip.body,
					borderColor: theme?.tooltip.border,
					borderWidth: 1,
					padding: 10,
					titleFont: { size: 12, weight: 'bold' as const },
					bodyFont: { size: 11 }
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					...(maxValue && { max: maxValue }),
					ticks: {
						font: { size: 11, weight: 500 },
						color: theme?.text,
						stepSize: maxValue ? Math.ceil(maxValue / 5) : undefined
					},
					grid: {
						color: theme?.grid,
						drawTicks: true
					}
				},
				x: {
					ticks: {
						font: { size: 11, weight: 500 },
						color: theme?.text
					},
					grid: { display: false }
				}
			}
		}
	});
}

/**
 * Create a time-series line chart with theme support
 * Used for daily adherence tracking and trends
 */
export function createTimeSeriesChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	dataPoints: number[],
	lineColor: string = '#3b82f6',
	fillColor: string = 'rgba(59, 130, 246, 0.1)',
	theme?: ChartTheme,
	yAxisMax?: number
) {
	return new Chart(ctx, {
		type: 'line',
		data: {
			labels,
			datasets: [{
				label: 'Conformitate zilnică (%)',
				data: dataPoints,
				borderColor: lineColor,
				backgroundColor: fillColor,
				tension: 0.35,
				fill: true
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					labels: {
						color: theme?.text,
						font: { size: 11, weight: 500 }
					}
				},
				tooltip: {
					backgroundColor: theme?.tooltip.bg,
					titleColor: theme?.tooltip.title,
					bodyColor: theme?.tooltip.body,
					borderColor: theme?.tooltip.border,
					borderWidth: 1,
					padding: 10,
					titleFont: { size: 12, weight: 'bold' as const },
					bodyFont: { size: 11 }
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					...(yAxisMax && { max: yAxisMax }),
					ticks: {
						color: theme?.text,
						font: { size: 11, weight: 500 }
					},
					grid: { color: theme?.grid }
				},
				x: {
					ticks: {
						color: theme?.text,
						font: { size: 11, weight: 500 }
					},
					grid: { color: theme?.grid }
				}
			}
		}
	});
}

/**
 * Create a distribution bar chart with theme support
 * Used for medication or treatment distribution visualization
 */
export function createDistributionChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	data: number[],
	barColor: string = '#8b5cf6',
	theme?: ChartTheme
) {
	const maxValue = Math.max(...data, 1);
	
	return new Chart(ctx, {
		type: 'bar',
		data: {
			labels,
			datasets: [{
				label: 'Distribuție',
				data,
				backgroundColor: barColor,
				borderRadius: 8
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: theme?.tooltip.bg,
					titleColor: theme?.tooltip.title,
					bodyColor: theme?.tooltip.body,
					borderColor: theme?.tooltip.border,
					borderWidth: 1,
					padding: 10,
					titleFont: { size: 12, weight: 'bold' as const },
					bodyFont: { size: 11 }
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					max: maxValue,
					ticks: {
						stepSize: 1,
						color: theme?.text,
						font: { size: 11, weight: 500 }
					},
					grid: { color: theme?.grid }
				},
				x: {
					ticks: {
						color: theme?.text,
						font: { size: 11, weight: 500 }
					},
					grid: { display: false }
				}
			}
		}
	});
}

export async function downloadBlobAsFile(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
