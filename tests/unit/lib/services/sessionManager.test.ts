/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  startSessionManager, 
  stopSessionManager, 
  logout, 
  getRemainingTime,
  isSessionManagerActive 
} from '$lib/services/sessionManager.js';

// Mock dependencies
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$lib/stores/auth', () => ({
  authStore: {
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn()
  }
}));

vi.mock('$lib/api/client', () => ({
  api: {
    refreshToken: vi.fn(() => Promise.resolve({ token: 'new-token', user: { id: 1 } }))
  }
}));

vi.mock('$lib/api/socket', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn()
  }
}));

describe('sessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopSessionManager();
    vi.useRealTimers();
  });

  describe('startSessionManager', () => {
    it('should be active after starting', () => {
      startSessionManager();
      expect(isSessionManagerActive()).toBe(true);
    });

    it('should add activity event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      startSessionManager();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('keypress', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
    });
  });

  describe('stopSessionManager', () => {
    it('should mark session as inactive after stopping', () => {
      startSessionManager();
      stopSessionManager();
      expect(isSessionManagerActive()).toBe(false);
    });

    it('should remove activity event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      startSessionManager();
      stopSessionManager();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), true);
    });
  });

  describe('logout', () => {
    it('should stop session manager and disconnect socket', async () => {
      const { socketClient } = await import('$lib/api/socket');
      const { authStore } = await import('$lib/stores/auth');
      
      startSessionManager();
      logout();
      
      expect(socketClient.disconnect).toHaveBeenCalled();
      expect(authStore.logout).toHaveBeenCalled();
      expect(isSessionManagerActive()).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return the inactivity timeout value', () => {
      const remaining = getRemainingTime();
      expect(remaining).toBe(30 * 60 * 1000); // 30 minutes
    });
  });
});
