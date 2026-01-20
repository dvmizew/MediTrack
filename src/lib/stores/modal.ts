import { writable } from 'svelte/store';

export interface ModalState {
	isOpen: boolean;
	title?: string;
	content?: string;
	type?: 'info' | 'warning' | 'error' | 'success';
	size?: 'sm' | 'md' | 'lg';
	showCancel?: boolean;
	confirmText?: string;
	cancelText?: string;
	onConfirm?: () => void | Promise<void>;
	onCancel?: () => void;
}

const initialState: ModalState = {
	isOpen: false,
	type: 'info',
	size: 'md',
	showCancel: false,
	confirmText: 'OK',
	cancelText: 'Anulează'
};

export const modalStore = writable<ModalState>(initialState);

export function openModal(options: Partial<ModalState>) {
	modalStore.update((state) => ({
		...state,
		...options,
		isOpen: true
	}));
}

export function closeModal() {
	modalStore.update((state) => ({
		...initialState,
		isOpen: false
	}));
}

export function showInfo(title: string, content: string, onConfirm?: () => void) {
	openModal({
		type: 'info',
		title,
		content,
		showCancel: false,
		confirmText: 'OK',
		onConfirm
	});
}

export function showWarning(title: string, content: string, onConfirm?: () => void) {
	openModal({
		type: 'warning',
		title,
		content,
		showCancel: false,
		confirmText: 'Înțeles',
		onConfirm
	});
}

export function showError(title: string, content: string, onConfirm?: () => void) {
	openModal({
		type: 'error',
		title,
		content,
		showCancel: false,
		confirmText: 'OK',
		onConfirm
	});
}

export function showSuccess(title: string, content: string, onConfirm?: () => void) {
	openModal({
		type: 'success',
		title,
		content,
		showCancel: false,
		confirmText: 'Excelent',
		onConfirm
	});
}

export function showConfirm(
	title: string,
	content: string,
	onConfirm: () => void | Promise<void>,
	onCancel?: () => void
) {
	openModal({
		type: 'warning',
		title,
		content,
		showCancel: true,
		confirmText: 'Confirmare',
		cancelText: 'Anulează',
		onConfirm,
		onCancel
	});
}
