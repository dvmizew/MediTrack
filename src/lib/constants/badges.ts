export type BadgeId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type BadgeMeta = {
	id: BadgeId;
	name: string;
	xp: number;
	gradient: string;
};

export const BADGES: BadgeMeta[] = [
	{ id: 'bronze', name: 'Bronz', xp: 0, gradient: 'from-orange-600 to-orange-800' },
	{ id: 'silver', name: 'Argint', xp: 1000, gradient: 'from-gray-400 to-gray-600' },
	{ id: 'gold', name: 'Aur', xp: 2000, gradient: 'from-yellow-400 to-yellow-600' },
	{ id: 'platinum', name: 'Platină', xp: 3000, gradient: 'from-blue-400 to-blue-600' },
	{ id: 'diamond', name: 'Diamant', xp: 4000, gradient: 'from-purple-500 to-purple-700' }
];

export function getBadgeMeta(id: string): BadgeMeta {
	return BADGES.find((b) => b.id === id) || BADGES[0];
}
