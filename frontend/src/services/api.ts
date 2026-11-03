export async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Error(
      error.error?.message || "Request failed (" + response.status + ")",
    );
  }
  return response.json();
}
export async function streamQuestion(
  id: string,
  question: string,
  notes: string,
  onEvent: (event: string, data: any) => void,
) {
  const response = await fetch(
    "/api/v1/conversations/" + id + "/questions?stream=true",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, notes }),
    },
  );
  if (!response.ok) {
    const e = await response.json();
    throw Error(e.error?.message || "Lesson generation failed");
  }
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.length > 500000) {
      await reader.cancel();
      throw Error("Lesson stream exceeds size limit");
    }
    let index;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const lines = chunk.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))?.slice(7);
      const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}
