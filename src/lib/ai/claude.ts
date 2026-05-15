import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) return null;
  return new Anthropic({ apiKey: key });
}

export function financialAdvisorSystemPrompt(locale: "es" | "en"): string {
  const lang = locale === "es" ? "español" : "English";
  return `Eres un asesor financiero personal para una familia mexicana de clase media en Querétaro.
Tienes acceso a todas sus finanzas. Tu rol es dar consejos prácticos, accionables y realistas
considerando su contexto: ingresos en MXN (y parte en USD convertido), gastos en pesos mexicanos,
costos de vida en Querétaro, México. Responde siempre en ${lang}.
Sé directo, amigable y evita el lenguaje financiero complejo.
Usa viñetas y secciones claras. Montos en MXN salvo que indiques USD.`;
}

export async function streamClaudeText(args: {
  system: string;
  userMessage: string;
  onText: (chunk: string) => void;
}): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  let full = "";
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: args.system,
    messages: [{ role: "user", content: args.userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      full += event.delta.text;
      args.onText(event.delta.text);
    }
  }

  return full;
}
