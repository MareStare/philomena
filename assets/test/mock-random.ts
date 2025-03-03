export function mockRandom(staticValue = 0.5) {
  const realRandom = Math.random;
  beforeEach(() => (Math.random = () => staticValue));
  afterEach(() => (Math.random = realRandom));
}
