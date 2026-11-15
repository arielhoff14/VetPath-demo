import { test } from "node:test";
import assert from "node:assert/strict";
import { organizeRequest } from "../lib/assistant";
test("unconfigured assistant handles newly worded scenarios and asks for missing facts", async () => {
  const key = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    for (const [message, species, subtype] of [
      ["My cockatiel has a sore wing in San Jose", "Exotics", "Bird"],
      [
        "A goat is limping in Lafayette since yesterday",
        "Farm animals",
        "Goat",
      ],
      ["My axolotl needs a clinic in 94103", "Other species", "axolotl"],
    ]) {
      const d = await organizeRequest(message);
      assert.equal(d.species, species);
      assert.equal(d.subtype, subtype);
      assert.equal(d.mode, "rule-based");
      assert.ok(
        d.summary.includes("Clinical urgency requires veterinary review"),
      );
    }
    assert.ok(
      (await organizeRequest("Please help my pet")).missing.length >= 3,
    );
  } finally {
    if (key) process.env.OPENAI_API_KEY = key;
  }
});
test("configured AI output is validated, emergency cues cannot be removed, errors disclose fallback", async () => {
  const original = globalThis.fetch,
    key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  try {
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                species: "Cat",
                subtype: null,
                service: "Urgent care",
                location: "San Francisco",
                emergency: false,
                concern: "Owner reports breathing difficulty",
                duration: null,
              }),
            },
          },
        ],
      });
    const d = await organizeRequest("My cat cannot breathe in San Francisco");
    assert.equal(d.mode, "ai");
    assert.equal(d.emergency, true);
    assert.equal(d.service, "Emergency");
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ message: { content: '{"species":"Invented animal"}' } }],
      });
    assert.equal(
      (await organizeRequest("My dog needs help")).mode,
      "rule-based-fallback",
    );
    globalThis.fetch = async () => {
      throw new Error("Test unavailable");
    };
    assert.equal(
      (await organizeRequest("My rabbit needs help")).species,
      "Exotics",
    );
  } finally {
    globalThis.fetch = original;
    if (key) process.env.OPENAI_API_KEY = key;
    else delete process.env.OPENAI_API_KEY;
  }
});
