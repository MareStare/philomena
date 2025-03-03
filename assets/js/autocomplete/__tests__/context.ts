import { listenAutocomplete } from '..';
import * as fs from 'fs';
import * as path from 'path';
import { fetchMock } from '../../../test/fetch-mock';
import store from '../../utils/store';
import { fireEvent } from '@testing-library/dom';
import { assertNotNull } from '../../utils/assert';
import { TextInputElement } from 'autocomplete/input';

export class TestContext {
  private input: TextInputElement;
  private popup: HTMLElement;
  readonly fakeAutocompleteResponse: Response;

  constructor(fakeAutocompleteResponse: Response) {
    this.fakeAutocompleteResponse = fakeAutocompleteResponse;

    vi.useFakeTimers().setSystemTime(0);
    fetchMock.enableMocks();
    fetchMock.mockResponse(this.fakeAutocompleteResponse);

    store.set('enable_search_ac', true);

    document.body.innerHTML = `
      <input
        class="test-input"
        data-autocomplete="multi-tags"
        data-autocomplete-condition="enable_search_ac"
        data-autocomplete-history-id="search-history"
      />
    `;

    listenAutocomplete();

    this.input = assertNotNull(document.querySelector('.test-input'));
    this.popup = assertNotNull(document.querySelector('.autocomplete'));

    expect(fetch).not.toBeCalled();
  }

  async focusInput() {
    this.input.focus();
    await vi.runAllTimersAsync();
  }

  async setInput(value: string) {
    if (document.activeElement !== this.input) {
      await this.focusInput();
    }

    const valueChars = [...value];

    const selectionStart = valueChars.indexOf('<');
    if (selectionStart >= 0) {
      valueChars.splice(selectionStart, 1);
    }

    const selectionEnd = valueChars.indexOf('>');
    if (selectionEnd >= 0) {
      valueChars.splice(selectionEnd, 1);
    }

    this.input.value = valueChars.join('');
    if (selectionStart >= 0) {
      this.input.selectionStart = selectionStart;
    }
    if (selectionEnd >= 0) {
      this.input.selectionEnd = selectionEnd;
    }

    fireEvent.input(this.input, { target: { value: this.input.value } });

    await vi.runAllTimersAsync();
  }

  async keyDown(code: string, params?: { ctrlKey?: boolean }) {
    fireEvent.keyDown(this.input, { code, ...(params ?? {}) });
    await vi.runAllTimersAsync();
  }

  expectRequests() {
    const snapshot = vi.mocked(fetch).mock.calls.map(([input]) => {
      const request = input as unknown as Request;
      const meta: Record<string, unknown> = {};

      const url = new URL(request.url);
      url.host = 'host.com';
      url.port = '';

      const methodAndUrl = `${request.method} ${url}`;

      if (request.credentials !== 'same-origin') {
        meta.credentials = request.credentials;
      }

      if (request.cache !== 'default') {
        meta.cache = request.cache;
      }

      if (Object.getOwnPropertyNames(meta).length === 0) {
        return methodAndUrl;
      }

      return {
        dest: methodAndUrl,
        meta,
      };
    });

    return expect(snapshot);
  }

  expectUi() {
    const input = this.inputSnapshot();
    const suggestions = this.suggestionsSnapshot();

    return expect({ input, suggestions });
  }

  expectInput() {
    return expect(this.inputSnapshot());
  }

  expectSuggestions() {
    return expect(this.suggestionsSnapshot());
  }

  suggestionsSnapshot() {
    console.log('expecting suggestions');

    const { popup } = this;

    if (popup.classList.contains('hidden')) {
      return [];
    }

    const snapshot = [...popup.children].map(el => {
      if (el.classList.contains('autocomplete__item--selected')) {
        return `👉 ${el.textContent!.trim()}`;
      }
      return el.textContent!.trim();
    });

    return snapshot;
  }

  inputSnapshot() {
    const { input } = this;

    const value = [...input.value];

    if (input.selectionStart) {
      value.splice(input.selectionStart, 0, '<');
    }

    if (input.selectionEnd) {
      const shift = input.selectionStart && input.selectionStart <= input.selectionEnd ? 1 : 0;

      value.splice(input.selectionEnd + shift, 0, '>');
    }

    return value.join('');
  }
}

export async function init(): TestContext {
  const fakeAutocompleteBuffer = await fs.promises
    .readFile(path.join(__dirname, '../../utils/__tests__/autocomplete-compiled-v2.bin'))
    .then(({ buffer }) => new Response(buffer));

  const ctx = new TestContext(fakeAutocompleteBuffer);

  expect(fetch).not.toHaveBeenCalled();

  await ctx.focusInput();

  ctx.expectRequests().toMatchInlineSnapshot(`
      [
        {
          "dest": "GET http://host.com/autocomplete/compiled?vsn=2&key=1970-0-1",
          "meta": {
            "cache": "force-cache",
            "credentials": "omit",
          },
        },
      ]
    `);

  ctx.expectUi().toMatchInlineSnapshot(`
    {
      "input": "",
      "suggestions": [],
    }
  `);

  return ctx;
}
