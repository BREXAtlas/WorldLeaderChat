const META_NARRATION = /\b(imagined|hypothetical|would likely|would probably|plausible reaction|reaction consistent|response imagined|posture|take:|style response|public-figure|a .*? response would|would note|would stress|would frame|would urge|would point to|voice would)\b/i;
const GENERIC_SPEAKER = /^(world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst)$/i;

function textOf(bundle) {
  return `${bundle?.event?.title || ""} ${bundle?.event?.kicker || ""} ${bundle?.event?.summary || ""} ${(bundle?.event?.sources || []).map((source) => source.label).join(" ")}`.toLowerCase();
}

function msg(speaker, text, kind = "satire", reaction = "") {
  return { speaker, text, kind, reaction };
}

export function dialogueNeedsRefinement(bundle) {
  const messages = bundle?.event?.messages;
  if (!Array.isArray(messages) || messages.length < 10 || messages.length > 14) return true;
  if (messages.some((message) => META_NARRATION.test(String(message?.text || "")))) return true;
  if (messages.some((message) => GENERIC_SPEAKER.test(String(message?.speaker || "").trim()))) return true;

  const counts = new Map();
  for (const message of messages) {
    if (!message || message.kind === "system") continue;
    const speaker = String(message.speaker || "").trim();
    counts.set(speaker, (counts.get(speaker) || 0) + 1);
  }
  const recurring = [...counts.values()].filter((count) => count >= 2).length;
  return recurring < 2;
}

function israeliElectionDialogue() {
  return [
    msg("UN Admin", "New thread: election confidence. The poll is real; the private replies are not.", "system"),
    msg("Netanyahu", "Seventy percent sounds dramatic until you ask who wrote the question and who is quoting it."),
    msg("Yair Lapid", "The question is whether voters trust the election. They answered before your press office could revise the wording."),
    msg("Netanyahu", "Voters also want security. That part of the poll seems to disappear whenever you open the spreadsheet."),
    msg("Benny Gantz", "Security and election confidence are not competing subscriptions. A country needs both active."),
    msg("Trump", "Polls can be very unfair. Unless they are good polls. Then they are extremely accurate."),
    msg("Lapid", "Thank you for entering the exact example nobody requested."),
    msg("Netanyahu", "I did not add him."),
    msg("Trump", "I was already in the group. Strong invitation. Best settings."),
    msg("Meloni", "Can somebody reassure the voters before this becomes an international masterclass in reassuring nobody?"),
    msg("UN Admin", "The poll was pinned. Trust remains an unverified attachment.", "system")
  ];
}

function usElectionThreatDialogue() {
  return [
    msg("UN Admin", "New exercise: election disruption. Please stop asking whether democracy has a backup password.", "system"),
    msg("Chuck Schumer", "We are planning for scenarios that used to sound too strange for a Senate hearing."),
    msg("Trump", "They are war-gaming an election because they are terrified of winning it the normal way."),
    msg("Adam Schiff", "The exercise is about what happens when somebody decides the normal way is optional."),
    msg("Trump", "There he is. Always a scenario. Never a ratings report."),
    msg("Obama", "Planning for a constitutional crisis is not causing one. Fire drills do not invent fire."),
    msg("Vance", "They do become suspicious when one party keeps rehearsing the same villain."),
    msg("Schumer", "The villain is whoever ignores certified results. Casting remains open."),
    msg("AOC", "Nothing says healthy democracy like having to tabletop whether the table survives the election."),
    msg("Trump", "The table is fine. I built better tables."),
    msg("UN Admin", "Contingency plan saved as DEMOCRACY_FINAL_v12_ACTUALLY_FINAL.pdf.", "system")
  ];
}

function houthiSaudiDialogue() {
  return [
    msg("UN Admin", "New thread: refinery attack claim. Keep the jokes aimed at strategy, not civilians.", "system"),
    msg("Saudi Arabia", "A defense pact was supposed to reduce surprises, not schedule the next one for Sunday morning."),
    msg("Houthis", "Consider this our objection to the regional seating chart."),
    msg("Iran", "Everyone is very eager to assign us administrative privileges we did not request in writing."),
    msg("Trump", "If Iran is aligned with them, Iran can unalign them. Very simple. Great word: unalign."),
    msg("Saudi Arabia", "Regional security has not traditionally responded to vocabulary inventions."),
    msg("Iran", "Neither has diplomacy responded well to threats written entirely in capital letters."),
    msg("Meloni", "The refinery is burning and somehow the argument has already become a branding workshop."),
    msg("Xi", "Energy markets prefer fewer messages beginning with ‘we claim responsibility.’"),
    msg("Trump", "Markets also prefer strength. Nobody has stronger market preferences."),
    msg("UN Admin", "Oil prices joined the chat and immediately turned off read receipts.", "system")
  ];
}

function iranMidtermDialogue() {
  return [
    msg("UN Admin", "New thread: Tehran, negotiations and the U.S. midterms. The calendar has entered the conflict.", "system"),
    msg("Iran", "Time is also leverage. Your election date is conveniently visible from here."),
    msg("Trump", "You think you can drag this out? I invented dragging negotiations out until the other side begs."),
    msg("Iran", "Then you understand the strategy better than your briefing suggested."),
    msg("Vance", "Turning a war into an election tactic does not make the tactic sophisticated."),
    msg("Obama", "It does make the election calendar part of the battlefield, which is the point."),
    msg("Trump", "Nobody is putting my midterms on their battlefield. We have our own battlefield. Much better."),
    msg("Iran", "Your reply appears to confirm that the timing is working."),
    msg("Macron", "Could the talks resume before both sides convert the calendar into a weapons system?"),
    msg("Putin", "Calendars have always been strategic. Some leaders simply announce it less loudly."),
    msg("UN Admin", "The negotiation deadline was moved. The campaign deadline declined to move with it.", "system")
  ];
}

function consulateDialogue() {
  return [
    msg("UN Admin", "New thread: five U.S. posts scheduled to close. Please stop calling diplomatic reach ‘unused office space.’", "system"),
    msg("Trump", "We are cutting waste. If an office is not making a deal, why is it paying rent?"),
    msg("Xi", "A disciplined question. China will be happy to ask it from the offices nearby."),
    msg("Trump", "Nobody offered you the offices."),
    msg("Xi", "Influence rarely waits for a formal listing."),
    msg("Macron", "Diplomacy is cheaper than discovering later that you needed diplomacy."),
    msg("Milei", "Have you considered one ambassador with five chainsaws and an excellent travel card?"),
    msg("Meloni", "That is not a diplomatic network. That is a touring production."),
    msg("Trump", "Touring productions make money. Embassies should learn something."),
    msg("Xi", "China has saved the listing."),
    msg("UN Admin", "Soft power was placed on the curb with a sign reading FREE TO A GOOD HOME.", "system")
  ];
}

function gazaDialogue() {
  return [
    msg("UN Admin", "New thread: Gaza plan. The proposal and rejection are sourced; the private replies are imagined.", "system"),
    msg("Trump", "Fifteen points. Very complete. People love a plan where the numbering does half the negotiating."),
    msg("Netanyahu", "I read all fifteen. The missing point was no withdrawal before disarmament."),
    msg("Trump", "That can be point sixteen. I got us to sixteen points. Progress."),
    msg("Netanyahu", "You may keep the numbering. I am keeping the condition."),
    msg("Macron", "A longer document is not the same thing as a narrower disagreement."),
    msg("Meloni", "At this rate the appendix will need its own ceasefire."),
    msg("Trump", "We can call it the seventeen-point plan. Seventeen is a winning number."),
    msg("Netanyahu", "Renaming the file does not change the military position."),
    msg("Xi", "China recommends agreeing on the document before increasing the page count."),
    msg("UN Admin", "File renamed: 15-POINT-PLAN_v8_FINAL_FINAL_USE_THIS_ONE.pdf.", "system")
  ];
}

function ukraineDialogue() {
  return [
    msg("UN Admin", "New thread: Ukraine security. The word ‘guarantee’ has requested legal counsel.", "system"),
    msg("Zelenskyy", "I asked for commitments, not another paragraph describing how deeply everyone understands the urgency."),
    msg("Putin", "Urgency is often what one side calls the other side refusing its timetable."),
    msg("Zelenskyy", "Missiles have been keeping the timetable without asking either of us."),
    msg("Trump", "I could settle this quickly. First, give me admin rights."),
    msg("Zelenskyy", "That sentence did not make the security guarantee feel more guaranteed."),
    msg("Macron", "Could we avoid negotiating the whole war through the group settings?"),
    msg("Putin", "The settings are the only part anyone appears willing to change."),
    msg("Meloni", "We have reached the traditional European phase where everyone defines commitment differently."),
    msg("Xi", "The group has acknowledged the concern without resolving any part of it."),
    msg("UN Admin", "Concern upgraded to profound. Material support remains in another thread.", "system")
  ];
}

function spaceDialogue() {
  return [
    msg("UN Admin", "New thread: launch successful. National prestige and billionaire pride are already exceeding payload limits.", "system"),
    msg("Elon Musk", "The rocket landed. Reusability remains undefeated."),
    msg("Jeff Bezos", "Congratulations. We will compare payload, altitude and adjectives after the data are public."),
    msg("Trump", "American rockets. Beautiful rockets. Ours leave better than anybody’s."),
    msg("Xi", "Space does not recognize campaign branding, although launch coverage apparently does."),
    msg("Elon Musk", "The physics are neutral. The memes are not."),
    msg("Bezos", "I have added humility to our next manifest. It has no listed mass."),
    msg("NASA", "Mission data are available. The subtweets are not part of the science package."),
    msg("Trump", "NASA should post more. Great missions, very under-posted."),
    msg("Musk", "Finally, a federal performance metric I understand."),
    msg("UN Admin", "The comparison thread achieved orbit despite repeated attempts to decommission it.", "system")
  ];
}

function aiDialogue() {
  return [
    msg("UN Admin", "New thread: AI announcement. Every participant has declared themselves the responsible adult.", "system"),
    msg("Sam Altman", "The model is more capable. The governance conversation remains in beta."),
    msg("Elon Musk", "Interesting definition of open. Also interesting definition of safe."),
    msg("Trump", "We need the best AI. American AI. It should know who won before the question is finished."),
    msg("Xi", "Technology leadership is measured in infrastructure, not adjectives."),
    msg("Altman", "Infrastructure is useful. So is not turning every benchmark into a sovereignty dispute."),
    msg("Musk", "Benchmarks are easier when you write the test and grade it."),
    msg("Macron", "Europe has prepared a regulation while the rest of you prepared a product launch."),
    msg("Trump", "Regulations do not launch. That is the problem with regulations."),
    msg("Xi", "The model has now observed ten definitions of control and selected none."),
    msg("UN Admin", "Human oversight is typing… and has been typing for several releases.", "system")
  ];
}

function tanSuitDialogue() {
  return [
    msg("UN Admin", "New thread: the tan suit has been reopened for television. National security remains unaffected.", "system"),
    msg("Obama", "I wore a suit. The country survived. Apparently the writers’ room did not move on."),
    msg("Larry David", "I saw an unresolved national trauma and thought: finally, affordable production design."),
    msg("Trump", "The suit was weak. Very low-energy color. Everybody knew it."),
    msg("Obama", "Thank you for proving the premise before the episode airs."),
    msg("Larry David", "Please stop generating free scenes. We have lawyers for that."),
    msg("Meloni", "America can turn beige fabric into a constitutional seminar. Impressive soft power."),
    msg("Trump", "My suits never needed a congressional hearing."),
    msg("Obama", "Several of the ties could have used bipartisan oversight."),
    msg("Larry David", "That is the show. Everybody go home."),
    msg("UN Admin", "The wardrobe controversy was renewed for another season.", "system")
  ];
}

function taylorDialogue() {
  return [
    msg("UN Admin", "New thread: music removed from a political post. Copyright has joined with counsel present.", "system"),
    msg("White House Comms", "The clip tested extremely well before the audio stopped being available."),
    msg("Taylor Swift", "My team reviewed the use. The silence you hear is the rights holder responding."),
    msg("Trump", "The video was better with the song. That means the song benefited too."),
    msg("Taylor Swift", "That is not how licensing works, even when explained in all caps."),
    msg("Vance", "Could we discuss whether the removal was automated or requested?"),
    msg("Swift", "My lawyers can discuss it in a format with fewer reaction emojis."),
    msg("White House Comms", "We are exploring alternate audio with fewer opinions."),
    msg("Obama", "This is what happens when campaign content meets an artist with organized metadata."),
    msg("Trump", "We will use a bigger song next time."),
    msg("UN Admin", "The post kept its views. The soundtrack exercised its right to remain silent.", "system")
  ];
}

function immigrationDialogue() {
  return [
    msg("UN Admin", "New thread: immigration poll. Every campaign has highlighted a different cell in the spreadsheet.", "system"),
    msg("Trump", "The numbers show people want a strong border. Very clear. Best clarity."),
    msg("Obama", "The numbers also show voters distinguish enforcement from chaos. Polls contain more than one row."),
    msg("Vance", "People are tired of a system that treats enforcement as an apology."),
    msg("AOC", "People are also tired of cruelty being marketed as operational efficiency."),
    msg("Trump", "There it is. They call borders cruel until the poll arrives."),
    msg("Obama", "And you call every inconvenient crosstab fake until it improves."),
    msg("Senate Staff", "We circulated the full methodology. Nobody has opened it, but reactions are strong."),
    msg("Meloni", "Congratulations. The poll has become a coalition government of selective reading."),
    msg("UN Admin", "The same survey was saved under four filenames beginning with DEFINITIVE.", "system")
  ];
}

function generalDialogue() {
  return [
    msg("UN Admin", "New thread: the event is real. Confidence levels in the replies are not independently verified.", "system"),
    msg("Trump", "I have reviewed it and already have the strongest interpretation."),
    msg("Macron", "Could we agree on the facts before competing over the dramatic interpretation?"),
    msg("Trump", "The facts are doing very well under my interpretation."),
    msg("Meloni", "That sentence made the meeting longer and the facts more nervous."),
    msg("Xi", "China is observing both the event and the speed with which everyone made it about themselves."),
    msg("Obama", "We may want to separate the development from the personality test."),
    msg("Trump", "The personality test had excellent ratings."),
    msg("Macron", "The agenda has again been defeated by the commentary on the agenda."),
    msg("Xi", "The typing indicator remains more stable than the consensus."),
    msg("UN Admin", "Agenda restored. Confidence in agenda: low.", "system")
  ];
}

export function buildDirectDialogue(bundle) {
  const text = textOf(bundle);
  if (/election integrity|integrity of israel|jewish israelis|october elections/.test(text)) return israeliElectionDialogue();
  if (/democrats.*election|election threats|voting disruption|wargame democracy|schumer/.test(text)) return usElectionThreatDialogue();
  if (/houthi|oil refinery|saudi arabia/.test(text)) return houthiSaudiDialogue();
  if (/iran.*midterm|midterm.*iran|dragging out talks|entangled in war/.test(text)) return iranMidtermDialogue();
  if (/consulate|diplomatic vacuum|open desk space/.test(text)) return consulateDialogue();
  if (/gaza|netanyahu|hamas/.test(text)) return gazaDialogue();
  if (/ukraine|zelensky|kyiv|russia|putin|serbia/.test(text)) return ukraineDialogue();
  if (/rocket|spacex|blue origin|nasa|spacecraft|moon|mars|launch/.test(text)) return spaceDialogue();
  if (/artificial intelligence|\bai\b|openai|sam altman|semiconductor|ai model/.test(text)) return aiDialogue();
  if (/tan suit|larry david/.test(text)) return tanSuitDialogue();
  if (/taylor swift|songs removed|copyright.*tiktok|tiktok.*copyright/.test(text)) return taylorDialogue();
  if (/immigration|deportation|border|ice raid/.test(text)) return immigrationDialogue();
  return generalDialogue();
}
