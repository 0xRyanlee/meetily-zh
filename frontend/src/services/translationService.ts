const BACKEND_URL = 'http://localhost:5167';

export async function translateToChineseAPI(text: string, model = 'gemma3:1b'): Promise<string> {
  if (!text || !text.trim()) return '';
  const response = await fetch(`${BACKEND_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model }),
  });
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const data = await response.json();
  return data.translation ?? '';
}
