export type FetchTextResult = {
  url: string;
  status: number;
  body: string;
  headers: Headers;
};

export async function fetchText(url: string, init: RequestInit = {}): Promise<FetchTextResult> {
  const response = await fetch(url, {
    redirect: init.redirect ?? "follow",
    headers: {
      "user-agent": "SeoGate/0.1",
      ...(init.headers ?? {}),
    },
    ...init,
  });
  return {
    url,
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  };
}

export async function fetchHeadNoFollow(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "manual",
    headers: { "user-agent": "SeoGate/0.1" },
  });
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
  };
}

export async function waitForUrl(url: string, timeoutMs = 60000) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "SeoGate/0.1" } });
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}
