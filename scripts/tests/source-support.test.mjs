import test from "node:test";
import assert from "node:assert/strict";
import { auditClaimNeedsReview, claimClearlySupported } from "../lib/source-support.mjs";

const gazaRecord = "Jared Kushner held a rare meeting with Hamas leadership in Egypt. After meeting with the US envoy, Hamas says it called on the Board of Peace to compel Israel to accept the plan.";

test("source auditor cannot reject a claim repeated in the stored source record", () => {
  const claim = "The details are sparse, but Hamas called on its Board of Peace to compel Israel to accept the plan.";
  assert.equal(claimClearlySupported(claim, gazaRecord), true);
  assert.equal(auditClaimNeedsReview(claim, gazaRecord), false);
});

test("editorial characterization without a new checkable fact is not a source failure", () => {
  const claim = "The debate has become increasingly outrageous, reflecting intense polarization.";
  assert.equal(auditClaimNeedsReview(claim, "Americans are sharply divided as the debate heats up and one participant called it outrageous."), false);
  assert.equal(auditClaimNeedsReview("Civil? Try polarizing. We need to stand up for our rights.", "Americans are sharply divided over transgender athletes."), false);
  assert.equal(auditClaimNeedsReview("Jared Kushner: Hamas, we’ll see what happens. But I’m not holding my breath.", gazaRecord), false);
  assert.equal(auditClaimNeedsReview("So, Robert, are we ready to face the AI apocalypse, or do we just hope it never happens?", "For more on AI safety, follow Robert Hart."), false);
  assert.equal(auditClaimNeedsReview("The Hundred's Joint Trophy: A Gender Fusion in Cricket Competitions", "The Hundred is launching a joint trophy combining men's and women's points in cricket competitions."), false);
  assert.equal(auditClaimNeedsReview("The Fair Hill Five: A Baffling Betting Bizarre", "The Fair Hill Five horse-racing betting coup has prompted an inquiry."), false);
  assert.equal(auditClaimNeedsReview("Horse Racing’s Most Recent Oddity", "Horse racing authorities are investigating an extraordinary betting coup."), false);
});

test("new actions, outcomes and people remain blocked", () => {
  assert.equal(auditClaimNeedsReview("Kushner fired Netanyahu after the meeting.", gazaRecord), true);
  assert.equal(auditClaimNeedsReview("A new envoy named Marco Bellini won the vote.", gazaRecord), true);
  assert.equal(auditClaimNeedsReview("Marco Bellini Wins Election", gazaRecord), true);
  assert.equal(auditClaimNeedsReview("Did Marco Bellini win the election?", gazaRecord), true);
  assert.equal(auditClaimNeedsReview("Did the plan pass with 52%?", gazaRecord), true);
  assert.equal(auditClaimNeedsReview("The talks produced a 30-day ceasefire.", gazaRecord), true);
});
