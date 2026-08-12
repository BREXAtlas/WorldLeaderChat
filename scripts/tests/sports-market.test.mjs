import test from "node:test";
import assert from "node:assert/strict";
import { classifySportsCoverageMarket } from "../lib/sports-market.mjs";

test("classifies the event market independently from the outlet market", () => {
  assert.equal(classifySportsCoverageMarket({
    title: "Lakers sale approved after record NBA deal",
    sourceMarket: "UK"
  }), "US");
  assert.equal(classifySportsCoverageMarket({
    title: "Why South America is lukewarm on a 2030 World Cup",
    sourceMarket: "US"
  }), "international");
});

test("uses the outlet market only when the sports event has no geographic signal", () => {
  assert.equal(classifySportsCoverageMarket({
    title: "St. Jude Championship tee times released",
    sourceMarket: "US"
  }), "US");
  assert.equal(classifySportsCoverageMarket({
    title: "Dressage team confirms its final roster",
    sourceMarket: "UK"
  }), "international");
});
