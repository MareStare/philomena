import { GetTagSuggestionsResponse } from 'autocomplete/client';
import { init } from './context';

it('requests server-side autocomplete if local autocomplete returns no results', async () => {
  const ctx = await init();

  fetchMock.mockResponse(request => {
    if (request.url.includes('/autocomplete/compiled')) {
      console.log('returning local autocomplete index');
      return ctx.fakeAutocompleteResponse;
    }

    console.log('returning server side suggestions');

    const mockServerSideSuggestions: GetTagSuggestionsResponse = {
      suggestions: [
        {
          alias: 'marvelous',
          canonical: 'beautiful',
          images: 30,
        },
        {
          canonical: 'mare',
          images: 20,
        },
        {
          canonical: 'market',
          images: 10,
        },
      ],
    };

    return JSON.stringify(mockServerSideSuggestions);
  });

  await ctx.setInput('mar');

  expect(fetch).toHaveBeenCalledTimes(2);

  ctx.expectUi().toMatchInlineSnapshot(`
    {
      "input": "mar<>",
      "suggestions": [
        "marvelous → beautiful  30",
        "mare  20",
        "market  10",
      ],
    }
  `);

  await ctx.keyDown('ArrowDown');
  await ctx.keyDown('Enter');

  ctx.expectUi().toMatchInlineSnapshot(`
    {
      "input": "beautiful<>",
      "suggestions": [],
    }
  `);
});
