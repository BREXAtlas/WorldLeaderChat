import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed } from "../lib/feed.mjs";

const source = { id: "test", publisher: "Test News", weight: 2 };

test("parseFeed reads RSS items and decodes HTML", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel><item>
      <title><![CDATA[Leaders meet &amp; discuss ceasefire]]></title>
      <link>https://example.com/world/story?utm_source=rss</link>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[<p>The president met the prime minister.</p>]]></description>
      <guid>story-1</guid>
    </item></channel></rss>`;
  const items = parseFeed(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Leaders meet & discuss ceasefire");
  assert.equal(items[0].url, "https://example.com/world/story");
  assert.equal(items[0].excerpt, "The president met the prime minister.");
  assert.equal(items[0].publishedAt, "2026-08-08T12:00:00.000Z");
});

test("parseFeed reads Atom entries", () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom"><entry>
      <title>Summit produces agreement</title>
      <link rel="alternate" href="https://example.org/summit" />
      <updated>2026-08-08T10:30:00Z</updated>
      <summary>Two governments announced a framework.</summary>
      <id>tag:example.org,2026:summit</id>
    </entry></feed>`;
  const items = parseFeed(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.org/summit");
  assert.equal(items[0].publisher, "Test News");
});
