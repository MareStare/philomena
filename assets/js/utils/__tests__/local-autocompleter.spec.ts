import { LocalAutocompleter } from '../local-autocompleter';
import { promises } from 'fs';
import { join } from 'path';
import { TextDecoder } from 'util';

describe('Local Autocompleter', () => {
  let mockData: ArrayBuffer;

  beforeAll(async () => {
    const mockDataPath = join(__dirname, 'autocomplete-compiled-v2.bin');
    /**
     * Read pre-generated binary autocomplete data
     *
     * Contains the tags: safe (6), forest (3), flower (1), flowers -> flower, fog (1),
     *                    force field (1), artist:test (1), explicit (0), grimdark (0),
     *                    grotesque (0), questionable (0), semi-grimdark (0), suggestive (0)
     */
    mockData = (await promises.readFile(mockDataPath, { encoding: null })).buffer;

    // Polyfills for jsdom
    global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
  });

  afterAll(() => {
    delete (global as Partial<typeof global>).TextEncoder;
    delete (global as Partial<typeof global>).TextDecoder;
  });

  describe('instantiation', () => {
    it('should be constructible with compatible data', () => {
      const result = new LocalAutocompleter(mockData);
      expect(result).toBeInstanceOf(LocalAutocompleter);
    });

    it('should NOT be constructible with incompatible data', () => {
      const versionDataOffset = 12;
      const mockIncompatibleDataArray = new Array(versionDataOffset).fill(0);
      // Set data version to 1
      mockIncompatibleDataArray[mockIncompatibleDataArray.length - versionDataOffset] = 1;
      const mockIncompatibleData = new Uint32Array(mockIncompatibleDataArray).buffer;

      expect(() => new LocalAutocompleter(mockIncompatibleData)).toThrow('Incompatible autocomplete format version');
    });
  });

  describe('topK', () => {
    const termStem = ['f', 'o'].join('');

    function expectLocalAutocomplete(term: string, topK = 5) {
      const localAutocomplete = new LocalAutocompleter(mockData);
      const actual = localAutocomplete.matchPrefix(term, topK);

      return expect(actual);
    }

    beforeEach(() => {
      window.booru.hiddenTagList = [];
    });

    it('should return suggestions for exact tag name match', () => {
      expectLocalAutocomplete('safe').toMatchInlineSnapshot(`
        [
          {
            "canonical": "safe",
            "images": 6,
          },
        ]
      `);
    });

    it('should return suggestion for original tag when passed an alias', () => {
      expectLocalAutocomplete('flowers').toMatchInlineSnapshot(`
        [
          {
            "alias": "flowers",
            "canonical": "flower",
            "images": 1,
          },
        ]
      `);
    });

    it('should return suggestions sorted by image count', () => {
      expectLocalAutocomplete(termStem).toMatchInlineSnapshot(`
        [
          {
            "canonical": "forest",
            "images": 3,
          },
          {
            "canonical": "fog",
            "images": 1,
          },
          {
            "canonical": "force field",
            "images": 1,
          },
        ]
      `);
    });

    it('should return namespaced suggestions without including namespace', () => {
      expectLocalAutocomplete('test').toMatchInlineSnapshot(`
        [
          {
            "canonical": "artist:test",
            "images": 1,
          },
        ]
      `);
    });

    it('should return only the required number of suggestions', () => {
      expectLocalAutocomplete(termStem, 1).toMatchInlineSnapshot(`
        [
          {
            "canonical": "forest",
            "images": 3,
          },
        ]
      `);
    });

    it('should NOT return suggestions associated with hidden tags', () => {
      window.booru.hiddenTagList = [1];
      expectLocalAutocomplete(termStem).toMatchInlineSnapshot(`[]`);
    });

    it('should return empty array for empty prefix', () => {
      expectLocalAutocomplete('').toMatchInlineSnapshot(`[]`);
    });
  });
});
