import { describe, it, expect } from 'vitest';
import { md5 } from '@/lib/md5';

describe('md5', () => {
  it('hashes empty string to known value', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });
  it('hashes "abc"', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });
});
