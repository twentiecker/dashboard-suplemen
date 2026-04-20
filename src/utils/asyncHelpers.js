export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitUntil = async (checker, timeout = 15000, interval = 60) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (checker()) return true;
    await wait(interval);
  }

  return false;
};

export const mapWithConcurrency = async (items, mapper, limit = 4) => {
  const results = new Array(items.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
};