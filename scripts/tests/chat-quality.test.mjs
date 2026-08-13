import test from "node:test";
import assert from "node:assert/strict";
import { dialogueProblems, dialogueSimilarity, dialogueStructureSimilarity, stockMemeDetected } from "../lib/chat-quality.mjs";
import { buildDirectDialogue, closingLineFor } from "../lib/article-dialogue.mjs";

function bundle({ title, summary, source, messages, meme = "The source stayed put while the spin changed seats." }) {
  return {
    event: {
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
      title,
      summary,
      article: { headline: title, dek: summary, body: [summary, summary], sourceCredit: "Based on original reporting." },
      sources: [{ publisher: "Test News", label: source || title, url: "https://example.com/story" }],
      messages: messages || [],
      meme
    }
  };
}

const genericMessages = [
  { speaker: "UN Admin", text: "New thread opened. The first confident reply arrived before the briefing finished loading.", kind: "system" },
  { speaker: "Trump", text: "I have reviewed it and already have the strongest interpretation.", kind: "satire" },
  { speaker: "Macron", text: "Could we agree on the facts before competing over the dramatic interpretation?", kind: "satire" },
  { speaker: "Trump", text: "The facts are doing very well under my interpretation.", kind: "satire" },
  { speaker: "Meloni", text: "That sentence made the meeting longer and the facts more nervous.", kind: "satire" },
  { speaker: "Xi", text: "China is observing both the event and the speed with which everyone made it about themselves.", kind: "satire" },
  { speaker: "Obama", text: "We may want to separate the development from the personality test.", kind: "satire" },
  { speaker: "Trump", text: "The personality test had excellent ratings.", kind: "satire" },
  { speaker: "Macron", text: "The agenda has again been defeated by the commentary on the agenda.", kind: "satire" },
  { speaker: "Xi", text: "The typing indicator remains more stable than the consensus.", kind: "satire" },
  { speaker: "UN Admin", text: "Agenda restored. Confidence in agenda: low.", kind: "system" }
];

test("recycled strongest-interpretation template is rejected", () => {
  const candidate = bundle({
    title: "Hospital patient-safety agency faces budget cuts",
    summary: "A federal healthcare research agency faces cuts after funding a checklist program that reduced central-line infections.",
    messages: genericMessages
  });
  const problems = dialogueProblems(candidate);
  assert.ok(problems.some((problem) => /recycled stock line/i.test(problem)));
  assert.ok(problems.some((problem) => /does not stay tied to the article/i.test(problem)));
});

test("fill-in-the-headline chat is rejected even when names and titles change", () => {
  const templated = (title, speakers) => [
    { speaker: "UN Admin", text: `Desk file: ${title}. The verified event is pinned; the argument is about its consequence.`, kind: "system" },
    { speaker: speakers[0], text: `I read ${title}. I want the immediate consequence stated before anyone turns it into a victory lap.`, kind: "satire" },
    { speaker: speakers[1], text: "That is the fact pattern we have to answer.", kind: "satire" },
    { speaker: speakers[0], text: `Then my question on ${title} is who takes responsibility for what follows.`, kind: "satire" },
    { speaker: speakers[2], text: `I will not turn ${title} into a slogan. The public still needs the decision, the timing and the cost separated.`, kind: "satire" },
    { speaker: speakers[1], text: "My answer starts with this reported detail. Interpretation comes after that sentence, not before it.", kind: "satire" },
    { speaker: speakers[3], text: "That is where the announcement meets the people expected to live with it.", kind: "satire" },
    { speaker: speakers[0], text: `I am not dodging ${title}; I am saying the official line is shorter than the consequence.`, kind: "satire" },
    { speaker: speakers[2], text: "I want each institution here to answer that record without borrowing a different story.", kind: "satire" },
    { speaker: speakers[1], text: `Then answer the file we actually opened—${title}—and leave the substitute headline in drafts.`, kind: "satire" },
    { speaker: "UN Admin", text: "The verified details stayed pinned; the spin requested a longer deadline.", kind: "system" }
  ];
  const first = bundle({ title: "Threads launches a VR app", summary: "Threads released a virtual-reality app.", messages: templated("Threads launches a VR app", ["Product Team", "Platform Users", "Security Desk", "Regulators"]) });
  const second = bundle({ title: "NASA explains the Roman telescope", summary: "NASA published a guide to the Roman telescope.", messages: templated("NASA explains the Roman telescope", ["Mission Control", "NASA", "Science Desk", "Research Team"]) });
  const problems = dialogueProblems(second, { existingBundles: [first] });
  assert.ok(problems.some((problem) => /fill-in-the-headline template/i.test(problem)));
  assert.ok(problems.some((problem) => /repeats the article headline/i.test(problem)));
  assert.ok(dialogueStructureSimilarity(first, second) >= 0.28);
});

test("third-person reaction summaries and consecutive speakers are rejected", () => {
  const messages = [
    { speaker: "UN Admin", text: "New thread: Gaza roadmap.", kind: "system" },
    { speaker: "Benjamin Netanyahu", text: "Frames the stance as non-negotiable security logic.", kind: "satire" },
    { speaker: "Benjamin Netanyahu", text: "Counts disarmament as the primary deliverable.", kind: "satire" },
    { speaker: "Donald Trump", text: "Signals irritation with the rejection.", kind: "satire" },
    { speaker: "Donald Trump", text: "Calls for decisive outcomes.", kind: "satire" },
    { speaker: "Macron", text: "I need a verification sequence before another victory statement.", kind: "satire" },
    { speaker: "Netanyahu", text: "The troops do not move before disarmament.", kind: "satire" },
    { speaker: "Trump", text: "The plan is still the best plan on the table.", kind: "satire" },
    { speaker: "Macron", text: "A table is not an agreement.", kind: "satire" },
    { speaker: "Netanyahu", text: "Neither is a timetable without security.", kind: "satire" },
    { speaker: "UN Admin", text: "The roadmap remained open.", kind: "system" }
  ];
  const problems = dialogueProblems(bundle({
    title: "Netanyahu rejects Gaza roadmap until Hamas disarms",
    summary: "Netanyahu rejected a US-backed Gaza roadmap and refused withdrawal until Hamas disarms.",
    messages
  }));
  assert.ok(problems.some((problem) => /describes a reaction instead of speaking/i.test(problem)));
  assert.ok(problems.some((problem) => /consecutive turns/i.test(problem)));
});

test("named stock meme templates are rejected", () => {
  assert.equal(stockMemeDetected("Drake meme: reject policy, approve chaos"), true);
  assert.equal(stockMemeDetected("The Moon received four tons. It did not sign for the package."), false);
});

test("article-specific builders create different conversations for different events", () => {
  const health = bundle({
    title: "AHRQ patient-safety research agency faces cuts",
    summary: "AHRQ funded a national ICU checklist effort that cut central-line infections by 41 percent and saved lives.",
    source: "Trump is laying waste to the agency that keeps hospital patients safe"
  });
  health.event.messages = buildDirectDialogue(health);
  health.event.meme = closingLineFor(health);

  const sport = bundle({
    title: "Frederick Richard wins first US gymnastics all-around title",
    summary: "Richard scored 170.015 and finished two points clear at the national championships.",
    source: "Fred Richard coasts to first national title at US gymnastics championships"
  });
  sport.event.messages = buildDirectDialogue(sport);
  sport.event.meme = closingLineFor(sport);

  assert.equal(dialogueProblems(health).length, 0);
  assert.equal(dialogueProblems(sport).length, 0);
  assert.notEqual(health.event.messages[0].kind, "system");
  assert.notEqual(sport.event.messages[0].kind, "system");
  assert.notEqual(health.event.messages[0].speaker, "UN Admin");
  assert.notEqual(sport.event.messages[0].speaker, "UN Admin");
  const similarity = dialogueSimilarity(health.event.messages, sport.event.messages);
  assert.equal(similarity.exactOverlap, 0);
  assert.notDeepEqual(health.event.messages.map((message) => message.speaker), sport.event.messages.map((message) => message.speaker));
});

test("UN Admin or any system narrator is rejected as the first chat message", () => {
  const messages = buildDirectDialogue(bundle({
    title: "AHRQ patient-safety research agency faces cuts",
    summary: "AHRQ funded a national ICU checklist effort that reduced infections and saved lives."
  }));
  messages.unshift({ speaker: "UN Admin", text: "The patient-safety argument has entered the room.", kind: "system", reaction: "" });
  const problems = dialogueProblems(bundle({
    title: "AHRQ patient-safety research agency faces cuts",
    summary: "AHRQ funded a national ICU checklist effort that reduced infections and saved lives.",
    messages
  }));
  assert.ok(problems.some((problem) => /must open with a direct event participant/i.test(problem)));
});

test("a generated line can never be assigned to a speaker it talks about", () => {
  const messages = [
    { speaker: "Japan", text: "We summoned the Russian ambassador because this visit crossed a diplomatic line.", kind: "satire" },
    { speaker: "Vladimir Putin", text: "This move by Putin is unacceptable; we will not accept it.", kind: "satire" },
    { speaker: "Russia", text: "We hear the protest, but our territorial position has not changed.", kind: "satire" },
    { speaker: "Japan", text: "Then our protest will remain as direct as the visit itself.", kind: "satire" },
    { speaker: "Vladimir Putin", text: "We will not negotiate sovereignty through a summoned ambassador.", kind: "satire" },
    { speaker: "Russia", text: "The dispute has survived decades and another statement will not settle it.", kind: "satire" },
    { speaker: "Japan", text: "A long dispute is not permission to make it disappear by presidential itinerary.", kind: "satire" },
    { speaker: "Vladimir Putin", text: "The itinerary reflects our position, which Tokyo already knows.", kind: "satire" },
    { speaker: "Russia", text: "We can acknowledge the protest without accepting the claim behind it.", kind: "satire" },
    { speaker: "Japan", text: "Diplomacy remains open, but so does the objection you just flew across.", kind: "satire" }
  ];
  const problems = dialogueProblems(bundle({
    title: "Japan protests Putin visit to disputed Kuril Islands",
    summary: "Japan summoned Russia's ambassador to protest Vladimir Putin's visit to the disputed Kuril Islands.",
    messages
  }));
  assert.ok(problems.some((problem) => /refer to themselves by name/i.test(problem)));
});

test("cross-article reuse of two or more lines is rejected", () => {
  const health = bundle({
    title: "AHRQ patient-safety research agency faces cuts",
    summary: "AHRQ funded a national ICU checklist effort that reduced infections and saved lives."
  });
  health.event.messages = buildDirectDialogue(health);
  health.event.meme = closingLineFor(health);

  const copied = bundle({
    title: "Frederick Richard wins US gymnastics title",
    summary: "Richard won the national all-around gymnastics championship with a two-point margin.",
    messages: structuredClone(health.event.messages),
    meme: "The podium closed. The 2028 group chat did not."
  });
  const problems = dialogueProblems(copied, { existingBundles: [health] });
  assert.ok(problems.some((problem) => /reuses too much dialogue/i.test(problem)));
});
