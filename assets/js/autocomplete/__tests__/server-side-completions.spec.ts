import { init } from './context';

it('requests server-side autocomplete if local autocomplete returns no results', async () => {
  const ctx = await init();

  await ctx.setInput('mar');

  expect(fetch).toHaveBeenCalledTimes(2);

  ctx.expectUi().toMatchInlineSnapshot(`
    {
      "input": "mar<>",
      "suggestions": [],
    }
  `);

  await ctx.keyDown('ArrowDown');
  await ctx.keyDown('Enter');

  ctx.expectUi().toMatchInlineSnapshot(`
    {
      "input": "mar<>",
      "suggestions": [],
    }
  `);
});
