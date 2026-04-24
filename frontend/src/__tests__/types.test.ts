import { describe, it, expect } from 'vitest';
import { formatBeat } from '../domain/types';

describe('formatBeat', () => {
  it('formats seconds', () => {
    expect(formatBeat(5, 'ss')).toBe('5s');
  });

  it('formats minutes', () => {
    expect(formatBeat(10, 'mm')).toBe('10m');
  });

  it('formats hours', () => {
    expect(formatBeat(2, 'hh')).toBe('2h');
  });

  it('formats days', () => {
    expect(formatBeat(1, 'dd')).toBe('1d');
  });

  it('handles multi-digit beat', () => {
    expect(formatBeat(30, 'ss')).toBe('30s');
  });
});
