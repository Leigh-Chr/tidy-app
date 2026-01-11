import { describe, it, expect } from 'vitest';
import { formatBytes, parseBytes } from './format-size.js';

describe('formatBytes', () => {
  describe('byte formatting', () => {
    it('formats zero bytes', () => {
      expect(formatBytes(0)).toBe('0B');
    });

    it('formats small byte values', () => {
      expect(formatBytes(1)).toBe('1B');
      expect(formatBytes(512)).toBe('512B');
      expect(formatBytes(1023)).toBe('1023B');
    });

    it('handles negative values as zero', () => {
      expect(formatBytes(-1)).toBe('0B');
      expect(formatBytes(-100)).toBe('0B');
    });
  });

  describe('kilobyte formatting', () => {
    it('formats exact kilobytes', () => {
      expect(formatBytes(1024)).toBe('1KB');
      expect(formatBytes(2048)).toBe('2KB');
      expect(formatBytes(10240)).toBe('10KB');
    });

    it('formats fractional kilobytes', () => {
      expect(formatBytes(1536)).toBe('1.5KB');
      expect(formatBytes(2560)).toBe('2.5KB');
    });

    it('omits .0 decimal', () => {
      expect(formatBytes(1024)).toBe('1KB');
      expect(formatBytes(5120)).toBe('5KB');
    });
  });

  describe('megabyte formatting', () => {
    it('formats exact megabytes', () => {
      expect(formatBytes(1048576)).toBe('1MB');
      expect(formatBytes(2097152)).toBe('2MB');
      expect(formatBytes(104857600)).toBe('100MB');
    });

    it('formats fractional megabytes', () => {
      expect(formatBytes(2621440)).toBe('2.5MB');
      expect(formatBytes(1572864)).toBe('1.5MB');
    });

    it('omits .0 decimal', () => {
      expect(formatBytes(1048576)).toBe('1MB');
      expect(formatBytes(10485760)).toBe('10MB');
    });
  });

  describe('gigabyte formatting', () => {
    it('formats exact gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1GB');
      expect(formatBytes(2147483648)).toBe('2GB');
    });

    it('formats fractional gigabytes', () => {
      expect(formatBytes(1610612736)).toBe('1.5GB');
      expect(formatBytes(2684354560)).toBe('2.5GB');
    });

    it('omits .0 decimal', () => {
      expect(formatBytes(1073741824)).toBe('1GB');
      expect(formatBytes(5368709120)).toBe('5GB');
    });
  });

  describe('boundary cases', () => {
    it('handles the KB boundary', () => {
      expect(formatBytes(1023)).toBe('1023B');
      expect(formatBytes(1024)).toBe('1KB');
    });

    it('handles the MB boundary', () => {
      expect(formatBytes(1048575)).toBe('1024KB');
      expect(formatBytes(1048576)).toBe('1MB');
    });

    it('handles the GB boundary', () => {
      expect(formatBytes(1073741823)).toBe('1024MB');
      expect(formatBytes(1073741824)).toBe('1GB');
    });
  });
});

describe('parseBytes', () => {
  describe('byte parsing', () => {
    it('parses byte values', () => {
      expect(parseBytes('0B')).toBe(0);
      expect(parseBytes('512B')).toBe(512);
      expect(parseBytes('1024B')).toBe(1024);
    });

    it('parses values without unit as bytes', () => {
      expect(parseBytes('100')).toBe(100);
    });
  });

  describe('kilobyte parsing', () => {
    it('parses integer kilobytes', () => {
      expect(parseBytes('1KB')).toBe(1024);
      expect(parseBytes('10KB')).toBe(10240);
    });

    it('parses fractional kilobytes', () => {
      expect(parseBytes('1.5KB')).toBe(1536);
      expect(parseBytes('2.5KB')).toBe(2560);
    });
  });

  describe('megabyte parsing', () => {
    it('parses integer megabytes', () => {
      expect(parseBytes('1MB')).toBe(1048576);
      expect(parseBytes('100MB')).toBe(104857600);
    });

    it('parses fractional megabytes', () => {
      expect(parseBytes('2.5MB')).toBe(2621440);
      expect(parseBytes('1.5MB')).toBe(1572864);
    });
  });

  describe('gigabyte parsing', () => {
    it('parses integer gigabytes', () => {
      expect(parseBytes('1GB')).toBe(1073741824);
      expect(parseBytes('2GB')).toBe(2147483648);
    });

    it('parses fractional gigabytes', () => {
      expect(parseBytes('1.5GB')).toBe(1610612736);
    });
  });

  describe('case insensitivity', () => {
    it('handles lowercase units', () => {
      expect(parseBytes('1kb')).toBe(1024);
      expect(parseBytes('1mb')).toBe(1048576);
      expect(parseBytes('1gb')).toBe(1073741824);
    });

    it('handles mixed case units', () => {
      expect(parseBytes('1Kb')).toBe(1024);
      expect(parseBytes('1Mb')).toBe(1048576);
    });
  });

  describe('invalid input handling', () => {
    it('returns 0 for empty string', () => {
      expect(parseBytes('')).toBe(0);
    });

    it('returns 0 for invalid format', () => {
      expect(parseBytes('invalid')).toBe(0);
      expect(parseBytes('MB')).toBe(0);
      expect(parseBytes('abc123')).toBe(0);
    });

    it('returns 0 for invalid units', () => {
      expect(parseBytes('1TB')).toBe(0); // TB not supported
      expect(parseBytes('1PB')).toBe(0);
    });
  });

  describe('roundtrip consistency', () => {
    it('formatBytes then parseBytes returns original value', () => {
      const testValues = [0, 512, 1024, 1536, 2621440, 1073741824];

      for (const value of testValues) {
        const formatted = formatBytes(value);
        const parsed = parseBytes(formatted);
        expect(parsed).toBe(value);
      }
    });
  });
});
