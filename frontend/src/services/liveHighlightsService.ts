const BACKEND_URL = 'http://localhost:5167';

export interface LiveHighlightsResponse {
  key_points: string[];
  action_items: string[];
  decisions: string[];
}

export async function generateLiveHighlights(
  transcript: string,
  model = 'gemma3:1b',
  maxItems = 5
): Promise<LiveHighlightsResponse> {
  const response = await fetch(`${BACKEND_URL}/live-highlights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      model,
      max_items: maxItems,
    }),
  });

  if (!response.ok) {
    throw new Error(`Live highlights request failed: ${response.status}`);
  }

  return response.json();
}
