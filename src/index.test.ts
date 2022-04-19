import { hasLocalSupport } from ".";

test("hasLocalSupport", async () => {
  const result = await hasLocalSupport();
  expect(result).toBe(0);
});
