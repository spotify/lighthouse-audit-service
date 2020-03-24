import { sum } from './math';

describe('math', () => {
  describe('sum', () => {
    it('sums 2 numbers', () => {
      expect(sum(1, 1)).toBe(2);
    });

    it('sums n numbers', () => {
      expect(sum(1, 2, 3, 4)).toBe(10);
    });

    it('returns a number if it is provided by itself', () => {
      expect(sum(10)).toBe(10);
    });

    it('returns 0 if no numbers are provided', () => {
      expect(sum()).toBe(0);
    });
  });
});
