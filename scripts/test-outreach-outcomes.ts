import assert from "node:assert/strict";
import {
    getOutreachOutcomeLabel,
    normalizeOutreachOutcomeKey,
    OUTREACH_OUTCOME_LABELS,
} from "../lib/outreach/outcomes";

for (const [key, label] of Object.entries(OUTREACH_OUTCOME_LABELS)) {
    assert.equal(normalizeOutreachOutcomeKey(key), key);
    assert.equal(getOutreachOutcomeLabel(key), label);
}

assert.equal(normalizeOutreachOutcomeKey("interested"), "connected_interested");
assert.equal(getOutreachOutcomeLabel("interested"), "Interested");
assert.equal(
    normalizeOutreachOutcomeKey("connected_not_interested"),
    "connected_not_interested",
);
assert.equal(
    getOutreachOutcomeLabel("connected_not_interested"),
    "Not Interested",
);
assert.equal(normalizeOutreachOutcomeKey("callback"), "callback_requested");
assert.equal(getOutreachOutcomeLabel("callback"), "Callback Requested");
assert.equal(normalizeOutreachOutcomeKey("voicemail"), "voicemail_left");
assert.equal(getOutreachOutcomeLabel("voicemail"), "Voicemail Left");
assert.equal(normalizeOutreachOutcomeKey("dnc"), "do_not_call");
assert.equal(getOutreachOutcomeLabel("dnc"), "Do Not Call");
assert.equal(normalizeOutreachOutcomeKey("unknown"), null);
assert.equal(getOutreachOutcomeLabel("unknown"), "unknown");

console.log("outreach outcome labels: ok");
