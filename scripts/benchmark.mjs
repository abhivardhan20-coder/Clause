import { performance } from "node:perf_hooks";
import { compareText, splitSources } from "../lib/documents.ts";
const original = Array.from(
  { length: 500 },
  (_, i) => "Clause " + i + ": Payment and delivery terms.",
).join("\n");
const revised = original.replace("Clause 250:", "Changed clause 250:");
function bench(name, run) {
  const times = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    scenario: name,
    medianMs: +times[25].toFixed(3),
    p95Ms: +times[47].toFixed(3),
  };
}
console.log(
  JSON.stringify(
    [
      bench("500 identical lines", () => compareText(original, original)),
      bench("one edit in 500 lines", () => compareText(original, revised)),
      bench("500 fully changed lines", () =>
        compareText(original, original.replaceAll("Clause", "Section")),
      ),
      bench("60,000-character source", () => splitSources("a".repeat(60000))),
    ],
    null,
    2,
  ),
);
