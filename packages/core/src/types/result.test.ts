import { describe, it, expect } from 'vitest';
import { ok, err, type Result } from './result.js';

describe('Result type', () => {
  describe('ok()', () => {
    it('creates a successful result with data', () => {
      const result = ok('test data');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('test data');
      }
    });

    it('works with objects', () => {
      const data = { id: 1, name: 'test' };
      const result = ok(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(data);
      }
    });

    it('works with arrays', () => {
      const data = [1, 2, 3];
      const result = ok(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('works with null', () => {
      const result = ok(null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('err()', () => {
    it('creates an error result with Error object', () => {
      const error = new Error('Something went wrong');
      const result = err(error);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('creates an error result with string', () => {
      const result = err('error message');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('error message');
      }
    });

    it('creates an error result with custom error type', () => {
      interface CustomError {
        code: string;
        message: string;
      }

      const customError: CustomError = { code: 'NOT_FOUND', message: 'File not found' };
      const result: Result<never, CustomError> = err(customError);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('File not found');
      }
    });
  });

  describe('type narrowing', () => {
    it('allows type-safe access after checking ok', () => {
      const successResult: Result<string> = ok('success');
      const errorResult: Result<string> = err(new Error('failure'));

      // Type narrowing should work
      if (successResult.ok) {
        // TypeScript knows data exists here
        expect(typeof successResult.data).toBe('string');
      }

      if (!errorResult.ok) {
        // TypeScript knows error exists here
        expect(errorResult.error instanceof Error).toBe(true);
      }
    });
  });
});
