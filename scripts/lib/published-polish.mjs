import { buildDirectDialogue, closingLineFor } from "./article-dialogue.mjs";
import { dialogueProblems } from "./chat-quality.mjs";

const POLISH = new Map([
  [
    "2026-08-10-francesca-hong-the-progressive-leading-a-messy-race-for-wisconsi",
    {
      title: "WISCONSIN’S DEMOCRATIC PRIMARY ADDS A SOCIALIST FRONTRUNNER; THE PARTY ESTABLISHMENT OPENS THE PANIC TAB",
      kicker: "Francesca Hong’s grassroots surge turns a crowded governor’s race into a fight over electability, party control and who gets to define ‘too far left.’"
    }
  ],
  [
    "2026-08-10-shoved-the-tube-so-hard-it-tore-my-nose-kurdish-film-maker-recou",
    {
      title: "ICE CALLS IT MEDICAL CARE; THE FEEDING TUBE LEFT A DIFFERENT RECORD",
      kicker: "A Kurdish filmmaker’s account of shackling, solitary confinement and force-feeding turns a detention-center medical procedure into a test of consent, oversight and accountability."
    }
  ],
  [
    "2026-08-09-top-democrats-simulate-election-threats-as-trump-continues-assau",
    {
      title: "SENATE DEMOCRATS WARGAME ELECTION CHAOS; DEMOCRACY ASKS WHY THE REHEARSAL NOW HAS CATERING",
      kicker: "Senior Democratic senators and legal experts run through possible election-disruption scenarios because contingency planning has become another part of campaign season."
    }
  ],
  [
    "2026-08-09-taylor-swift-songs-removed-from-trump-and-white-house-s-social-m",
    {
      title: "TAYLOR SWIFT’S SONGS VANISH FROM TRUMP POSTS; COPYRIGHT FINDS THE MUTE BUTTON",
      kicker: "Trump and White House social posts keep their political message while the Swift soundtrack disappears, leaving communications staff to discover that engagement does not include a music license."
    }
  ],
  [
    "2026-08-08-fifa-warns-of-effort-to-undermine-infantino-as-leadership-crisis",
    {
      title: "FIFA TRIES TO SELL A SLICE OF THE WORLD CUP; UEFA ASKS WHO GAVE IT THE LISTING",
      kicker: "A collapsed $4.2 billion commercial-rights proposal turns into a leadership crisis, resignation calls and football governance doing its best impression of extra time."
    }
  ],
  [
    "2026-08-08-rest-assured-the-new-cdc-director-thinks-abortion-surveillance-i",
    {
      title: "CDC CONFIRMATION HEARING ADDS ‘ABORTION SURVEILLANCE’; PUBLIC HEALTH REQUESTS A DEFINITION BEFORE THE DATABASE",
      kicker: "Dr. Erica Schwartz’s confirmation exchange with Senator Josh Hawley turns routine public-health data collection into a larger argument over surveillance, privacy and political intent."
    }
  ],
  [
    "2026-08-08-president-xi-never-wastes-a-good-crisis-as-iran-ukraine-and-pale",
    {
      title: "THREE GLOBAL CRISES DISTRACT THE ROOM; XI USES THE QUIET TO TIGHTEN HIS GRIP",
      kicker: "As Iran, Ukraine and Palestine dominate attention, an analysis argues that Beijing is pressing its advantage abroad and consolidating control at home."
    }
  ],
  [
    "2026-08-07-one-of-science-fiction-s-greatest-writers-warned-us-about-a-ai-d",
    {
      title: "ASIMOV LEFT THREE LAWS FOR ROBOTS; THE AI INDUSTRY OPENS A 94-PAGE TERMS-OF-SERVICE UPDATE",
      kicker: "A modern proposal for three laws of AI asks whether safety rules can survive systems built to optimize, persuade and act at global scale."
    }
  ],
  [
    "2026-08-07-the-white-house-s-plan-to-vet-potentially-dangerous-ai-is-cloake",
    {
      title: "WHITE HOUSE WRITES AI SAFETY RULES IN PRIVATE; THE PUBLIC GETS A PASSWORD SCREEN",
      kicker: "A safety-testing framework shared with major AI companies but withheld from public view turns model oversight into a debate over secrecy, access and who gets to grade the exam."
    }
  ],
  [
    "2026-08-07-trump-imposes-15-tariff-on-key-chip-material-to-counter-china",
    {
      title: "TRUMP PUTS A 15% TARIFF ON CHIP MATERIAL; THE SUPPLY CHAIN ASKS WHO IS PAYING THE PATRIOTISM FEE",
      kicker: "A new tariff meant to shield U.S. semiconductor firms from Chinese competition adds another cost, another bargaining chip and another spreadsheet to the technology race."
    }
  ]
]);

function appendReviewNote(event, note) {
  event.editorial = {
    ...(event.editorial || {}),
    reviewNotes: [...new Set([event.editorial?.reviewNotes, note].filter(Boolean))].join(" ")
  };
}

function normalizeDirectLanguage(messages) {
  return messages.map((message) => ({
    ...message,
    text: String(message.text || "").replace(/\bhypothetical\b/gi, "simulated")
  }));
}

export function polishPublishedEvents(inputEvents) {
  const events = structuredClone(inputEvents || []);
  const changes = [];

  for (const event of events) {
    const update = POLISH.get(event.id);
    if (!update) continue;

    const article = structuredClone(event.article || null);
    const sources = structuredClone(event.sources || []);
    event.title = update.title;
    event.kicker = update.kicker;
    event.messages = normalizeDirectLanguage(buildDirectDialogue({ event }));
    event.meme = closingLineFor({ event });
    event.article = article;
    event.sources = sources;
    appendReviewNote(event, "Published chat and headline were replaced with article-specific direct dialogue; the approved article and original sources were preserved.");

    const problems = dialogueProblems({ event });
    if (problems.length) {
      throw new Error(`Published polish failed for ${event.id}: ${problems.join(" | ")}`);
    }
    changes.push({ eventId: event.id, issueNumber: event.editorial?.issueNumber ?? null });
  }

  return { events, changes };
}

export const publishedPolishIds = [...POLISH.keys()];
