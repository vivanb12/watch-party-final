import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  genres: z.array(z.string().max(40)).max(20),
  moods: z.array(z.string().max(40)).max(20),
  candidates: z
    .array(z.object({ id: z.number(), title: z.string().max(200), year: z.number().nullable(), genres: z.array(z.string()), overview: z.string().max(400).nullable() }))
    .max(60),
});

export type Suggestion = { id: number; reason: string };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "reason"], properties: { id: { type: "integer" }, reason: { type: "string" } } },
    },
  },
};

export const suggestMovies = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ picks: Suggestion[]; error?: string }> => {
    // Any OpenAI-compatible provider that supports the Responses API works here.
    const key = process.env["AI_API_KEY"];
    const baseUrl = (process.env["AI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env["AI_MODEL"] ?? "gpt-4o-mini";
    const reasoningEffort = process.env["AI_REASONING_EFFORT"]; // optional: only for reasoning models
    if (!key) return { picks: [], error: "AI suggestions aren't configured." };
    if (!data.candidates.length) return { picks: [], error: "No movies match those genres yet." };

    const list = data.candidates.map((c) => `${c.id} | ${c.title} (${c.year ?? "?"}) | ${c.genres.join(", ")} | ${(c.overview ?? "").slice(0, 160)}`).join("\n");
    const res = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        store: false,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        instructions: "You pick movies for a group watch party. Choose up to 5 movies ONLY from the candidate list that best satisfy the whole group's genres and moods. Give a short, warm one-sentence reason for each mentioning which members' tastes it fits.",
        input: `Group genres: ${data.genres.join(", ") || "any"}\nGroup moods: ${data.moods.join(", ") || "any"}\n\nCandidates (id | title | genres | overview):\n${list}`,
        text: { format: { type: "json_schema", name: "group_pick", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = res.status === 429 ? "Too many requests — try again in a moment." : res.status === 402 ? "AI credits have run out for the configured provider." : `AI request failed (${res.status}).`;
      return { picks: [], error: msg };
    }

    // consume SSE stream, accumulating output text
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw) as { type?: string; delta?: string };
            if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          } catch {
            /* partial */
          }
        }
      }
    }
    try {
      const ids = new Set(data.candidates.map((c) => c.id));
      const parsed = JSON.parse(text) as { picks: Suggestion[] };
      return { picks: parsed.picks.filter((p) => ids.has(p.id)).slice(0, 5) };
    } catch {
      return { picks: [], error: "The AI couldn't decide — try again." };
    }
  });
