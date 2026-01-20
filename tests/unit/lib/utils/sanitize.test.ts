import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOMPurify before importing
vi.mock('dompurify', () => {
	return {
		default: {
			sanitize: (input: string) => {
				// Basic sanitization logic for testing
				let output = input;
				// Remove script tags
				output = output.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
				// Remove style tags
				output = output.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
				// Remove iframe tags
				output = output.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
				// Remove event handlers (onclick, onerror, etc.)
				output = output.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
				// Remove javascript: URLs
				output = output.replace(/javascript:[^"']*/gi, '');
				return output;
			}
		}
	};
});

import { sanitizeHTML } from '$lib/utils/sanitize';

describe('sanitizeHTML', () => {
	it('should allow safe HTML tags', () => {
		const input = '<p>Hello <strong>World</strong></p>';
		const output = sanitizeHTML(input);
		expect(output).toContain('<p>');
		expect(output).toContain('<strong>');
		expect(output).toContain('Hello');
		expect(output).toContain('World');
	});

	it('should remove script tags', () => {
		const input = '<p>Test</p><script>alert("XSS")</script>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('<script>');
		expect(output).not.toContain('alert');
		expect(output).toContain('Test');
	});

	it('should remove onclick handlers', () => {
		const input = '<button onclick="alert(\'XSS\')">Click</button>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('onclick');
		expect(output).toContain('Click');
	});

	it('should remove javascript: URLs', () => {
		const input = '<a href="javascript:alert(\'XSS\')">Link</a>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('javascript:');
	});

	it('should allow basic formatting tags', () => {
		const input = '<em>italic</em> <strong>bold</strong> <u>underline</u>';
		const output = sanitizeHTML(input);
		expect(output).toContain('<em>');
		expect(output).toContain('<strong>');
		expect(output).toContain('<u>');
	});

	it('should handle empty strings', () => {
		const output = sanitizeHTML('');
		expect(output).toBe('');
	});

	it('should handle plain text without HTML', () => {
		const input = 'Hello World';
		const output = sanitizeHTML(input);
		expect(output).toBe('Hello World');
	});

	it('should remove style tags', () => {
		const input = '<style>body { background: red; }</style><p>Test</p>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('<style>');
		expect(output).toContain('Test');
	});

	it('should remove iframe tags', () => {
		const input = '<iframe src="http://evil.com"></iframe><p>Test</p>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('<iframe>');
		expect(output).toContain('Test');
	});

	it('should handle nested malicious HTML', () => {
		const input = '<div><script>alert("XSS")</script><p>Safe content</p></div>';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('<script>');
		expect(output).toContain('Safe content');
	});

	it('should preserve safe attributes', () => {
		const input = '<a href="https://example.com" title="Example">Link</a>';
		const output = sanitizeHTML(input);
		expect(output).toContain('href');
		expect(output).toContain('https://example.com');
		expect(output).toContain('title');
	});

	it('should handle special characters', () => {
		const input = '<p>&lt;script&gt;alert("test")&lt;/script&gt;</p>';
		const output = sanitizeHTML(input);
		expect(output).toContain('&lt;');
		expect(output).toContain('&gt;');
	});

	it('should remove onerror handlers', () => {
		const input = '<img src="x" onerror="alert(\'XSS\')">';
		const output = sanitizeHTML(input);
		expect(output).not.toContain('onerror');
	});

	it('should handle multiple XSS attempts', () => {
		const input = `
			<script>alert("XSS1")</script>
			<img src="x" onerror="alert('XSS2')">
			<a href="javascript:alert('XSS3')">Click</a>
			<p onclick="alert('XSS4')">Safe text</p>
		`;
		const output = sanitizeHTML(input);
		expect(output).not.toContain('<script>');
		expect(output).not.toContain('onerror');
		expect(output).not.toContain('javascript:');
		expect(output).not.toContain('onclick');
		expect(output).toContain('Safe text');
	});
});
