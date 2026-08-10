import {
  buildDirectDialogue as buildBaseDialogue,
  closingLineFor as baseClosingLineFor,
  dialogueNeedsRefinement
} from "./newsroom-dialogue.mjs";

const msg = (speaker, text, kind = "satire") => ({ speaker, text, kind, reaction: "" });

function headlineText(bundle) {
  const event = bundle?.event || {};
  return `${event.title || ""} ${event.article?.headline || ""} ${event.summary || ""} ${(event.sources || []).map((source) => source.label).join(" ")}`.toLowerCase();
}

function israelElectionDialogue() {
  return [
    msg("UN Admin", "New thread: confidence in Israel’s October election. Seventy percent has entered the chat without a campaign slogan.", "system"),
    msg("Netanyahu", "A poll about fear is not a finding that the election itself is compromised."),
    msg("Yair Lapid", "When seven in ten voters say they fear the process, dismissing the fear becomes part of the process."),
    msg("Netanyahu", "The government will protect the vote. The opposition will protect its headline."),
    msg("Benny Gantz", "Election security is not a party favor. Publish the safeguards and let voters inspect them."),
    msg("Yair Lapid", "Exactly. Reassurance without details is just another campaign poster."),
    msg("Trump", "Polls can be unfair. Unless they are good polls. Then they are extremely accurate."),
    msg("Netanyahu", "I did not ask for an American seminar on polling."),
    msg("Trump", "You got the premium version. No charge."),
    msg("Benny Gantz", "Can the government answer the confidence question before the guest lecturer adds a second hour?"),
    msg("UN Admin", "The poll was pinned. Trust remains an attachment voters are still trying to open.", "system")
  ];
}

function launchDialogue() {
  return [
    msg("UN Admin", "New thread: SpaceX launch completed. Payload data is posted; billionaire scorekeeping arrived first.", "system"),
    msg("Elon Musk", "The vehicle flew, the mission worked and the rocket did what the slide deck promised."),
    msg("Jeff Bezos", "Congratulations. We will compare payload, reusability and how many adjectives survived ascent."),
    msg("Musk", "Reusable hardware beats reusable press releases."),
    msg("NASA", "The mission data are available. The founder subtweets are not part of the payload."),
    msg("Bezos", "Competition is useful. It keeps one company from declaring every launch the final form of spaceflight."),
    msg("Trump", "American rocket, American technology, tremendous altitude. Put a flag on the invoice."),
    msg("Musk", "The invoice has mass limits. The flag metaphor does not."),
    msg("Xi", "Space capability is measured by sustained infrastructure, not one successful livestream."),
    msg("Bezos", "Agreed. Which is why the next launch is already on the calendar."),
    msg("UN Admin", "The spacecraft reached its destination. The rivalry remained in low Earth orbit.", "system")
  ];
}

function wisconsinPrimaryDialogue() {
  return [
    msg("UN Admin", "New thread: Wisconsin governor’s primary. Francesca Hong is leading late, and the party’s electability debate has escaped the strategy memo.", "system"),
    msg("Francesca Hong", "Voters keep telling us they are tired of the status quo. Apparently the status quo has a very active donor list."),
    msg("Wisconsin Democratic Establishment", "Winning a primary and winning statewide are not the same assignment."),
    msg("Hong", "Then make the case to voters. Sending every alarm at once is not a case."),
    msg("Trump", "I found the old tweets. Very radical. Wisconsin is going to love seeing every one of them."),
    msg("Primary Voter", "You are all discussing our ballot like it is a malfunction in the consultant dashboard."),
    msg("Wisconsin Democratic Establishment", "The concern is what happens after the primary, when the Republican attack machine stops warming up and starts spending."),
    msg("Hong", "A candidate who survives by sounding afraid of her own program is not electable either."),
    msg("Trump", "Keep talking. My campaign has snacks and screen recordings."),
    msg("Primary Voter", "The more both parties tell us who is allowed to win, the more interesting the forbidden option becomes."),
    msg("UN Admin", "The race remained messy. The frontrunner kept the momentum; the establishment kept the emergency meeting.", "system")
  ];
}

function electionWargameDialogue() {
  return [
    msg("UN Admin", "New thread: Senate Democrats are running election-disruption exercises. Legal counsel has requested that nobody call it a dress rehearsal.", "system"),
    msg("Chuck Schumer", "We are planning for scenarios that would have sounded absurd a few years ago. The absurdity did not wait for our approval."),
    msg("Trump", "They are wargaming because they know they cannot beat me in the actual game."),
    msg("Adam Schiff", "The exercise is about courts, certification and lawful responses if somebody tries to break the process."),
    msg("Trump", "Every time Democrats lose an argument, they turn it into a seminar with binders."),
    msg("Election Lawyer", "The binder exists because deadlines do not pause while politicians improvise constitutional theories."),
    msg("Mark Warner", "You rehearse cyberattacks and natural disasters. Election disruption deserves the same refusal to be surprised."),
    msg("Trump", "The surprise will be how smoothly the election goes when everyone stops inventing threats."),
    msg("Schumer", "Preparedness is not invention. It is what adults do after someone spends years advertising the possible crisis."),
    msg("Election Lawyer", "For the record, the scenarios are hypothetical. The statutes and deadlines are very real."),
    msg("UN Admin", "The simulation ended on schedule. The reason it felt necessary did not.", "system")
  ];
}

function cdcSurveillanceDialogue() {
  return [
    msg("UN Admin", "New thread: CDC confirmation and abortion surveillance. Public-health data has asked whether it is evidence, policy or a future subpoena.", "system"),
    msg("Josh Hawley", "The country needs national data. If states are not reporting, the CDC should know what is happening."),
    msg("Erica Schwartz", "Public-health surveillance means tracking population trends. It cannot become shorthand for treating patients as suspects."),
    msg("Hawley", "Then say clearly whether the agency will maintain complete abortion data."),
    msg("Schwartz", "I will say clearly that methodology, privacy and lawful authority matter before a politically loaded demand becomes a dashboard."),
    msg("HHS", "The CDC has spent a year without stable leadership. The confirmation was supposed to restore operational focus."),
    msg("Hawley", "Operational focus includes answering Congress without hiding behind technical language."),
    msg("Schwartz", "Technical language is sometimes the difference between measuring health and monitoring people."),
    msg("Public Health Researcher", "A dataset can inform policy. It can also intimidate patients if officials refuse to explain its limits."),
    msg("Hawley", "Oversight is not intimidation merely because the question is uncomfortable."),
    msg("UN Admin", "The director was confirmed. The word ‘surveillance’ left the hearing with more political baggage than data.", "system")
  ];
}

function xiCrisisDialogue() {
  return [
    msg("UN Admin", "New thread: while Iran, Ukraine and Palestine dominate the agenda, Beijing’s strategic calendar remains fully booked.", "system"),
    msg("Xi", "China does not schedule its national priorities around another country’s news cycle."),
    msg("Trump", "China loves a distraction. Very strategic. I know strategy."),
    msg("Taiwan", "Pressure does not become less visible because three other crises are louder."),
    msg("Xi", "Questions involving China’s sovereignty are not invitations for outside commentary."),
    msg("EU Council", "The concern is precisely what happens when sovereignty is used to close every discussion about coercion and minorities."),
    msg("Xi", "Europe may manage its own contradictions before exporting definitions of order."),
    msg("Taiwan", "The world being distracted is not the same as the people under pressure being confused."),
    msg("Trump", "If everybody is watching three fires, Beijing checks which doors are unlocked. That is the game."),
    msg("Xi", "Calling long-term policy a game does not make short-term improvisation a strategy."),
    msg("UN Admin", "The crises stayed in the headlines. Beijing kept working in the margins.", "system")
  ];
}

function asimovAiDialogue() {
  return [
    msg("UN Admin", "New thread: modern laws for AI, inspired by Asimov. The machines have not agreed to the terms because the terms are still in committee.", "system"),
    msg("AI Safety Researcher", "A system should not harm people, deceive them or escape meaningful human control. That sounds obvious until incentives arrive."),
    msg("Elon Musk", "I have warned that advanced AI may stop taking orders. The warning keeps being treated like product marketing."),
    msg("Sam Altman", "Useful systems need autonomy within limits. The hard part is proving the limits work outside a demo."),
    msg("AI Safety Researcher", "Then publish the tests, the failure modes and who can shut the system down."),
    msg("Musk", "A shutdown switch controlled by one company is not civilization-level governance."),
    msg("EU Commission", "Which is why enforceable law cannot be replaced by a founder promising to be careful."),
    msg("Altman", "Law matters. So does avoiding rules so static that only irresponsible developers can move quickly."),
    msg("Asimov Archive", "The original laws were fiction designed to reveal loopholes, not a compliance certificate."),
    msg("AI Safety Researcher", "Exactly. A law that sounds elegant but cannot survive edge cases is a plot device."),
    msg("UN Admin", "Humanity drafted three laws. The exceptions section achieved artificial general length.", "system")
  ];
}

function chipTariffDialogue() {
  return [
    msg("UN Admin", "New thread: 15% tariff on a key chip material. Industrial policy and the supply chain have entered from different time zones.", "system"),
    msg("Trump", "We are protecting American chip companies. Fifteen percent is a strong number and China understands strong numbers."),
    msg("U.S. Chipmaker", "Protection helps only if the material cost does not reach us before the new domestic capacity does."),
    msg("Importer", "The tariff arrives at customs today. The replacement supply chain is still in a presentation."),
    msg("Xi", "Restricting competition does not create technical leadership. It raises the price of discovering that."),
    msg("Trump", "China subsidized its industry for years. We are finally charging admission."),
    msg("U.S. Chipmaker", "Then tell manufacturers whether the goal is leverage, revenue or enough time to build at home."),
    msg("Importer", "And tell customers which part of the invoice should be labeled national security."),
    msg("Xi", "Markets will adjust. They often adjust by finding routes politicians did not include in the speech."),
    msg("Trump", "American companies will win. The tariff makes sure everybody knows which side the government is on."),
    msg("UN Admin", "The tariff protected the strategy. The supply chain forwarded the cost estimate.", "system")
  ];
}

function iceForceFeedingDialogue() {
  return [
    msg("UN Admin", "New thread: alleged ICE force-feeding at Port Isabel. Medical care and coercion are disputing ownership of the same room.", "system"),
    msg("ICE", "Medical intervention becomes necessary when a detainee’s health is at immediate risk."),
    msg("Medical Ethics Board", "Necessity does not erase consent, force or the obligation to document exactly what was done."),
    msg("DHS Inspector General", "The allegation includes shackling, restraint and a feeding tube that reportedly caused injury. That requires records, not a slogan."),
    msg("ICE", "Facility staff operate under clinical and security protocols."),
    msg("Senate Oversight", "Then produce the protocols, the medical authorization and the incident review."),
    msg("Trump", "ICE has a hard job. People attack the officers and ignore the border problem."),
    msg("Medical Ethics Board", "A hard job is not a medical standard. The question is whether treatment became punishment."),
    msg("DHS Inspector General", "And whether solitary confinement made meaningful consent impossible before the procedure began."),
    msg("ICE", "The agency will respond through the formal review process."),
    msg("UN Admin", "The facility called it care. The injury report demanded a fuller sentence.", "system")
  ];
}

function secretAiFrameworkDialogue() {
  return [
    msg("UN Admin", "New thread: White House AI safety framework. Testing criteria are finalized and the public has received a locked screen.", "system"),
    msg("White House Tech Office", "The framework works better if companies cannot game the tests before submitting a model."),
    msg("Anthropic", "Confidential test details can be reasonable. Confidential standards with no public accountability are a different product."),
    msg("OpenAI", "Developers need enough clarity to build safeguards before a model reaches evaluation."),
    msg("Trump", "The best companies are in the room. We do not need to publish every question before the exam."),
    msg("Cybersecurity Researcher", "The public does need to know what risks count, who decides a model passes and what happens when it fails."),
    msg("Meta", "A voluntary process also needs consistent access. Selective criteria can become selective advantage."),
    msg("White House Tech Office", "The companies will receive the information required to participate."),
    msg("EU Commission", "That explains access for the companies. It does not explain oversight for everyone affected by the systems."),
    msg("Trump", "If we publish everything, China reads it too. Very simple."),
    msg("UN Admin", "The safety framework passed confidentiality review. Transparency remains in the waiting room.", "system")
  ];
}

function taylorCopyrightDialogue() {
  return [
    msg("UN Admin", "New thread: Taylor Swift songs removed from Trump and White House posts. Copyright has joined with counsel present.", "system"),
    msg("White House Comms", "The clip tested extremely well before the audio stopped being available."),
    msg("Taylor Swift", "My team reviewed the use. The silence is the rights holder responding."),
    msg("Trump", "The video was better with the song. That means the song benefited too."),
    msg("Swift", "That is not how licensing works, even when explained in all caps."),
    msg("Vance", "Was the removal automated or requested? The answer changes the communications plan."),
    msg("Swift", "My lawyers can discuss that in a format with fewer reaction emojis."),
    msg("White House Comms", "We are exploring alternate audio with fewer opinions."),
    msg("Obama", "This is what happens when campaign content meets an artist with organized metadata."),
    msg("Trump", "We will use a bigger song next time."),
    msg("UN Admin", "The post kept its views. The soundtrack exercised its right to remain silent.", "system")
  ];
}

export function buildDirectDialogue(bundle) {
  const text = headlineText(bundle);
  if (/force.feed|gabar choli|port isabel|feeding tube.*ice/.test(text)) return iceForceFeedingDialogue();
  if (/white house.*ai.*secret|ai safety framework|vet potentially dangerous ai|testing criteria.*private/.test(text)) return secretAiFrameworkDialogue();
  if (/taylor swift.*song|songs removed.*trump|white house.*swift/.test(text)) return taylorCopyrightDialogue();
  if (/francesca hong|wisconsin.*governor|wisconsin.*primary/.test(text)) return wisconsinPrimaryDialogue();
  if (/simulate election threats|wargame democracy|election disruption.*exercise|democrats.*election.*scenario/.test(text)) return electionWargameDialogue();
  if (/abortion surveillance|erica schwartz|cdc director.*hawley/.test(text)) return cdcSurveillanceDialogue();
  if (/president xi never wastes|iran.*ukraine.*palestine.*xi|xi.*good crisis/.test(text)) return xiCrisisDialogue();
  if (/asimov|three laws of ai|laws of robotics/.test(text)) return asimovAiDialogue();
  if (/15% tariff.*chip|tariff.*chip material|chip material.*china/.test(text)) return chipTariffDialogue();
  if (/israel.*election|election.*israel|jewish israelis.*election|october elections/.test(text)) return israelElectionDialogue();
  if (/spacex.*launch|launch.*spacex|rocket mission|rocket launch/.test(text) && !/crash|struck the moon|hit the moon/.test(text)) return launchDialogue();
  return buildBaseDialogue(bundle);
}

export function closingLineFor(bundle) {
  const text = headlineText(bundle);
  if (/force.feed|gabar choli|port isabel|feeding tube.*ice/.test(text)) return "The facility called it care. The injury report asked who was allowed to refuse.";
  if (/white house.*ai.*secret|ai safety framework|vet potentially dangerous ai|testing criteria.*private/.test(text)) return "The AI safety rules were completed. Public access failed the test.";
  if (/taylor swift.*song|songs removed.*trump|white house.*swift/.test(text)) return "The post kept the fireworks. Copyright muted the soundtrack.";
  if (/francesca hong|wisconsin.*governor|wisconsin.*primary/.test(text)) return "Hong built a grassroots campaign. The party establishment responded with a leaf blower.";
  if (/simulate election threats|wargame democracy|election disruption.*exercise/.test(text)) return "Democracy entered the war room and asked why contingency planning had become a recurring meeting.";
  if (/abortion surveillance|erica schwartz|cdc director.*hawley/.test(text)) return "The CDC got a permanent director. The definition of surveillance remained under observation.";
  if (/president xi never wastes|xi.*good crisis|iran.*ukraine.*palestine.*xi/.test(text)) return "The world opened three emergency tabs. Beijing quietly changed the permissions on a fourth.";
  if (/asimov|three laws of ai|laws of robotics/.test(text)) return "Asimov supplied three laws. The industry immediately requested an API exemption.";
  if (/15% tariff.*chip|tariff.*chip material|chip material.*china/.test(text)) return "The chip race gained a 15% speed bump and called it acceleration.";
  if (/israel.*election|election.*israel|october elections/.test(text)) return "The ballot boxes are not open yet. The trust deficit already is.";
  if (/spacex.*launch|launch.*spacex|rocket mission|rocket launch/.test(text) && !/crash|moon/.test(text)) return "The rocket completed the mission. The billionaire scoreboard requested an extension.";
  return baseClosingLineFor(bundle);
}

export { dialogueNeedsRefinement };
