import { retry, RetryFunc, RetryParams } from '../retry';

describe('retry', () => {
  async function expectRetry<R>(params: RetryParams, func?: RetryFunc<R>) {
    const spy = vi.fn(func ?? (() => Promise.reject(new Error('always failing'))));

    const result = await retry(spy, params).catch(err => `throw ${err}`);

    const retries = spy.mock.calls.map(([attempt, nextDelayMs]) => {
      const suffix = nextDelayMs === undefined ? '' : 'ms';
      return `${attempt}: ${nextDelayMs}${suffix}`;
    });

    return expect([...retries, result]);
  }

  // Remove randomness and real delays from the tests.
  const real = {
    random: Math.random,
    setTimeout,
  };

  beforeEach(() => {
    Math.random = () => 0.5;
    globalThis.setTimeout = ((func: () => void) => func()) as typeof globalThis.setTimeout;
  });

  afterEach(() => {
    Math.random = real.random;
    globalThis.setTimeout = real.setTimeout;
  });

  describe('stops on a successful attempt', () => {
    it('first attempt', async () => {
      (await expectRetry({}, async () => 'ok')).toMatchInlineSnapshot(`
        [
          "1: 200ms",
          "ok",
        ]
      `);
    });
    it('middle attempt', async () => {
      const func: RetryFunc<'ok'> = async attempt => {
        if (attempt !== 3) {
          throw new Error('middle failure');
        }
        return 'ok';
      };

      (await expectRetry({}, func)).toMatchInlineSnapshot(`
        [
          "1: 200ms",
          "2: 300ms",
          "3: 600ms",
          "ok",
        ]
      `);
    });
    it('last attempt', async () => {
      const func: RetryFunc<'ok'> = async attempt => {
        if (attempt !== 4) {
          throw new Error('last failure');
        }
        return 'ok';
      };

      (await expectRetry({}, func)).toMatchInlineSnapshot(`
        [
          "1: 200ms",
          "2: 300ms",
          "3: 600ms",
          "4: undefined",
          "ok",
        ]
      `);
    });
  });

  it('produces a reasonable retry sequence within maxAttempts', async () => {
    (await expectRetry({})).toMatchInlineSnapshot(`
      [
        "1: 200ms",
        "2: 300ms",
        "3: 600ms",
        "4: undefined",
        "throw Error: All 3 attempts of running spy failed: Error: always failing",
      ]
    `);

    (await expectRetry({ maxAttempts: 5 })).toMatchInlineSnapshot(`
      [
        "1: 200ms",
        "2: 300ms",
        "3: 600ms",
        "4: 1125ms",
        "5: 1125ms",
        "6: undefined",
        "throw Error: All 5 attempts of running spy failed: Error: always failing",
      ]
    `);
  });

  it('turns into a fixed delay retry algorithm if min/max bounds are equal', async () => {
    (await expectRetry({ maxAttempts: 3, minDelayMs: 200, maxDelayMs: 200 })).toMatchInlineSnapshot(`
      [
        "1: 200ms",
        "2: 200ms",
        "3: 200ms",
        "4: undefined",
        "throw Error: All 3 attempts of running spy failed: Error: always failing",
      ]
    `);
  });

  it('allows for zero delay', async () => {
    (await expectRetry({ maxAttempts: 3, minDelayMs: 0, maxDelayMs: 0 })).toMatchInlineSnapshot(`
      [
        "1: 0ms",
        "2: 0ms",
        "3: 0ms",
        "4: undefined",
        "throw Error: All 3 attempts of running spy failed: Error: always failing",
      ]
    `);
  });

  describe('fails on first non-retryable error', () => {
    it('all errors are retryable', async () => {
      (await expectRetry({ isRetryable: () => false })).toMatchInlineSnapshot(`
        [
          "1: 200ms",
          "throw Error: always failing",
        ]
      `);
    });
    it('middle error is non-retriable', async () => {
      const func: RetryFunc<never> = async attempt => {
        if (attempt === 3) {
          throw new Error('non-retryable');
        }
        throw new Error('retryable');
      };

      const params: RetryParams = {
        isRetryable: error => error.message === 'retryable',
      };

      (await expectRetry(params, func)).toMatchInlineSnapshot(`
        [
          "1: 200ms",
          "2: 300ms",
          "3: 600ms",
          "throw Error: non-retryable",
        ]
      `);
    });
  });

  it('rejects invalid inputs', async () => {
    (await expectRetry({ maxAttempts: 0 })).toMatchInlineSnapshot(`
      [
        "throw Error: Invalid 'maxAttempts' for retry: 0",
      ]
    `);
    (await expectRetry({ minDelayMs: -1 })).toMatchInlineSnapshot(`
      [
        "throw Error: Invalid 'minDelayMs' for retry: -1",
      ]
    `);
    (await expectRetry({ maxDelayMs: 100 })).toMatchInlineSnapshot(`
      [
        "throw Error: Invalid 'maxDelayMs' for retry: 100, 'minDelayMs' is 200",
      ]
    `);
  });
});
