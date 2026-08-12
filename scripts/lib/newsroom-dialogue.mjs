import { dialogueProblems } from "./chat-quality.mjs";

function headlineText(bundle) {
  const event = bundle?.event || {};
  return `${event.title || ""} ${event.article?.headline || ""} ${(event.sources || []).map((source) => source.label).join(" ")}`.toLowerCase();
}

function fullText(bundle) {
  const event = bundle?.event || {};
  return `${headlineText(bundle)} ${event.kicker || ""} ${event.summary || ""} ${event.article?.dek || ""}`.toLowerCase();
}

function msg(speaker, text, kind = "satire", reaction = "") {
  return { speaker, text, kind, reaction };
}

function gazaDialogue() {
  return [
    msg("UN Admin", "New thread: Gaza roadmap. Fifteen points are in the file; withdrawal and disarmament are fighting over the order.", "system"),
    msg("Trump", "I sent a fifteen-point plan. Fifteen is enough points for peace and at least three press conferences."),
    msg("Netanyahu", "The number is not the issue. No withdrawal happens before Hamas is genuinely disarmed."),
    msg("Trump", "Then put that in point sixteen. I just improved the plan by one point."),
    msg("Bassem Naim", "A roadmap stops being a roadmap when one side can erase the road after everyone signs."),
    msg("Netanyahu", "An endorsement is not disarmament, and a timetable is not a security guarantee."),
    msg("Macron", "You are negotiating sequence as if the sequence were not the entire agreement."),
    msg("Trump", "The agreement is very close. It only needs the people in the agreement to agree."),
    msg("Bassem Naim", "That sentence is why the mediators keep asking Washington to apply pressure."),
    msg("Netanyahu", "Pressure does not replace verification. The troops move when the condition is real."),
    msg("UN Admin", "The plan remains at fifteen points. The argument has reached page forty-two.", "system")
  ];
}

function houthiSaudiDialogue() {
  return [
    msg("UN Admin", "New thread: Saudi refinery attack claim. The defense pact is two days old and already has notifications.", "system"),
    msg("Saudi Arabia", "We signed a pact to reduce regional surprises. This is not the welcome packet."),
    msg("Houthis", "Consider the refinery strike our review of the new security arrangement."),
    msg("Saudi Arabia", "Reviews normally arrive without drones and a fire crew."),
    msg("Iran", "Everyone is assigning us admin privileges we did not request in writing."),
    msg("Trump", "If Tehran has influence, use it. Influence that cannot stop a strike is terrible influence."),
    msg("Iran", "Threats in capital letters have not improved your own influence record."),
    msg("Saudi Arabia", "Meanwhile, Hormuz is still restricted and the refinery is still the part on fire."),
    msg("Meloni", "A defense pact, a shipping crisis and a refinery strike in one weekend is not deterrence. It is a group project without a coordinator."),
    msg("Houthis", "The region received the message. Whether it likes the sender is a separate question."),
    msg("UN Admin", "Oil prices joined the thread and immediately enabled priority notifications.", "system")
  ];
}

function healthcareAgencyDialogue() {
  return [
    msg("UN Admin", "New thread: AHRQ patient-safety research. The checklist saved lives; the budget document has asked for a shorter name.", "system"),
    msg("Trump", "If an agency is important, people should know the agency. Nobody knows these initials."),
    msg("AHRQ", "Hospitals knew the work. Central-line infections fell 41 percent after the national safety program."),
    msg("ICU Nurse", "The checklist worked because a nurse could stop a surgeon before a preventable infection started."),
    msg("Trump", "Good checklist. Maybe hospitals can keep the checklist without keeping the agency."),
    msg("AHRQ", "The checklist did not research, fund and spread itself across more than a thousand intensive-care units."),
    msg("White House Budget Office", "The savings are estimated in billions. The line item is still being treated like clutter."),
    msg("Obama", "This is the usual problem with prevention: success looks like nothing happened, so somebody decides nothing did the work."),
    msg("ICU Nurse", "Twenty-nine thousand avoided deaths do not become less real because they are missing from a headline."),
    msg("Trump", "Then give me a better headline. Agencies need branding too."),
    msg("UN Admin", "Patient safety submitted the numbers again. The budget meeting requested a logo.", "system")
  ];
}

function gymnasticsDialogue() {
  return [
    msg("UN Admin", "New thread: Frederick Richard wins the U.S. all-around title with 170.015. The 2028 predictions have started early.", "system"),
    msg("Frederick Richard", "I wanted the national title, not another paragraph about potential. Two days, six events, job done."),
    msg("Shane Wiskus", "Two points clear is not subtle. You could have left the rest of us a decimal."),
    msg("Richard", "Gymnastics has spent years teaching me that every decimal belongs to whoever lands it."),
    msg("Team USA", "Paris bronze was the team chapter. This title makes the Los Angeles chapter harder to ignore."),
    msg("Trump", "American gymnastics. Great flips. Very strong landing. We should score all negotiations like this."),
    msg("Wiskus", "Then every negotiation would end with six judges and somebody filing an inquiry."),
    msg("Richard", "Fine by me. I brought the routines and the receipt: 170.015."),
    msg("LA 2028", "Please stop calling this a preview. The pressure department is already fully staffed."),
    msg("Team USA", "A first national title is not an Olympic medal, but it is an excellent way to make everyone update the depth chart."),
    msg("UN Admin", "The podium closed. The 2028 group chat did not.", "system")
  ];
}

function fedCookDialogue() {
  return [
    msg("UN Admin", "New thread: Lisa Cook, Fed independence and another White House removal letter. The June ruling is still pinned.", "system"),
    msg("Trump", "The Court said there is a process. We are using the process very strongly."),
    msg("Lisa Cook", "Sending the allegation again does not turn last year’s claim into new evidence."),
    msg("White House Counsel", "The letter says the president is considering removal. Every verb was selected with the ruling open beside it."),
    msg("Cook", "Institutional independence becomes decorative if the same pressure returns in a different envelope."),
    msg("Trump", "Independent does not mean unaccountable. It definitely does not mean untouchable."),
    msg("Fed Board", "It means monetary policy is not supposed to change every time the White House changes stationery."),
    msg("Senate Banking Staff", "We have now received the same dispute in legal, political and campaign fonts."),
    msg("Trump", "The font is excellent. The underlying issue is still the underlying issue."),
    msg("Cook", "And the Supreme Court’s limit is still the Supreme Court’s limit."),
    msg("UN Admin", "The Fed remained independent. The letter remained extremely interested.", "system")
  ];
}

function tariffRefundDialogue() {
  return [
    msg("UN Admin", "New thread: $165 billion in tariffs collected, about $100 billion refunded after the court ruling. Accounting has entered with counsel.", "system"),
    msg("Trump", "The tariffs were powerful. Even the refunds are huge. Nobody has ever refunded like this."),
    msg("U.S. Customs", "We have returned roughly 60 percent. The remaining claims are still producing spreadsheets."),
    msg("Importer", "You collected the money as policy and returned it as paperwork. Our cash flow experienced both versions."),
    msg("Trump", "The policy forced everyone to respect American trade. The refund proves we can also be flexible."),
    msg("Supreme Court Clerk", "The ruling used the word illegal, not flexible."),
    msg("Xi", "China notes that a liberation-day tariff has developed a return policy."),
    msg("Importer", "Does the return include interest, or is that another freedom we purchase separately?"),
    msg("Trump", "The companies got a tremendous lesson in resilience. Lessons are valuable."),
    msg("U.S. Customs", "The Court of International Trade would still like the remaining $65 billion explained in numbers."),
    msg("UN Admin", "The tariff left as a refund. The slogan was marked final sale.", "system")
  ];
}

function ukraineRefineryDialogue() {
  return [
    msg("UN Admin", "New thread: Ukrainian strikes on Russian oil facilities in Tatarstan and Tyumen. The word pressure is now visible from orbit.", "system"),
    msg("Zelenskyy", "Refineries finance the war. Hitting them is pressure with an address, not a metaphor."),
    msg("Putin", "Kyiv calls every escalation pressure and every Russian response proof of aggression."),
    msg("Zelenskyy", "The refinery fire does not need help identifying which side brought the drones."),
    msg("Tyumen Governor", "Several drones fell at an industrial facility. Emergency services handled the fire."),
    msg("Putin", "Regional officials report incidents. Western headlines write strategy around the smoke."),
    msg("EU Energy Desk", "Oil infrastructure has a habit of turning military messages into market prices before diplomats finish speaking."),
    msg("Zelenskyy", "That is why the facilities matter. Moscow understands pressure when it reaches revenue."),
    msg("Xi", "Energy markets prefer stability. Neither side appears to be submitting stability proposals."),
    msg("Putin", "Russia will answer attacks on strategic infrastructure on its own timetable."),
    msg("UN Admin", "Moscow called it an incident. Kyiv called it pressure. The refinery supplied the smoke.", "system")
  ];
}

function unSecretaryDialogue() {
  return [
    msg("UN Vote Counter", "New thread: the next secretary-general contest. The private straw poll has developed public body language.", "system"),
    msg("Rebeca Grynspan", "If the institution wants its first woman leader, it can begin by treating that as a qualification, not a ceremonial sentence."),
    msg("Trump", "The UN needs someone who can make deals and send smaller invoices."),
    msg("Xi", "The secretary-general must preserve multilateral balance, not audition for one capital."),
    msg("Grynspan", "Balance is not silence. The office has to say what the members prefer to leave in footnotes."),
    msg("Security Council", "Five permanent members have read that message and interpreted it five permanent ways."),
    msg("Meloni", "The first woman to lead the UN should not need unanimous permission to sound qualified."),
    msg("Trump", "Qualifications are good. Winning the vote is the qualification that matters most."),
    msg("Xi", "That is an unusually concise description of the veto system."),
    msg("Grynspan", "Then perhaps the campaign can spend less time praising history and more time deciding whether to make it."),
    msg("UN Vote Counter", "The ballot stayed secret. The positioning did not.", "system")
  ];
}

function independentVotersDialogue() {
  return [
    msg("UN Admin", "New thread: independent voters like several policies and dislike both parties’ labels. Branding has requested a recount.", "system"),
    msg("Independent Voter", "I can support the policy without joining the fan club printed on the yard sign."),
    msg("Trump", "If you like strong borders and American jobs, the label is obvious."),
    msg("AOC", "If you like lower costs and stronger public programs, the policy is also obvious."),
    msg("Independent Voter", "You both heard me reject the labels and immediately offered larger labels."),
    msg("Vance", "Voters want outcomes, but labels tell them who will actually fight for the outcome."),
    msg("Obama", "Labels also let campaigns avoid explaining where the popular parts end and the unpopular parts begin."),
    msg("Independent Voter", "Exactly. I ordered the policy. Stop insisting it comes with a personality bundle."),
    msg("Trump", "The personality bundle gets excellent ratings."),
    msg("AOC", "And there is the surcharge nobody saw in the poll question."),
    msg("UN Admin", "The crosstabs remained independent. Both parties claimed custody.", "system")
  ];
}

function cyberModelDialogue() {
  return [
    msg("UN Admin", "New thread: OpenAI flags a model approaching a critical cybersecurity threshold. Access controls have entered before the launch party.", "system"),
    msg("Sam Altman", "The capability is useful enough that releasing it normally would be irresponsible."),
    msg("Cybersecurity Researcher", "That is a polished way to say the model may help defenders and attackers with the same keyboard."),
    msg("Elon Musk", "Interesting. The safety plan is now ‘trust the company that built the capability.’"),
    msg("Altman", "The plan includes restricted access, monitoring and pausing work where the risk is too high."),
    msg("Trump", "We need the strongest cyber model, but it should only be strong for us. Very secure arrangement."),
    msg("EU Commission", "A control is not a control merely because the product announcement contains the word responsible."),
    msg("Cybersecurity Researcher", "The test is whether safeguards survive contact with a motivated user, not a policy memo."),
    msg("Xi", "Strategic technology is never governed only by the company that introduces it."),
    msg("Altman", "Agreed. That is why the threshold warning was public before the model was broadly available."),
    msg("UN Admin", "The model passed the benchmark. Humanity requested a second benchmark for judgment.", "system")
  ];
}

function moonCrashDialogue() {
  return [
    msg("UN Admin", "New thread: a four-ton Falcon 9 stage has struck the Moon and produced a dust plume. Lunar customer service is unavailable.", "system"),
    msg("SpaceX", "The stage completed an unplanned high-velocity surface interaction."),
    msg("NASA", "That phrase is doing a great deal of work for the word crash."),
    msg("Elon Musk", "It reached the Moon. Most discarded hardware cannot say that."),
    msg("Jeff Bezos", "Congratulations on converting orbital debris into a delivery metric."),
    msg("Musk", "A delivery is successful when the payload reaches the destination."),
    msg("NASA", "There was no payload, no customer and no requested destination."),
    msg("China National Space Administration", "The dust plume is scientifically useful. The parking technique is less instructive."),
    msg("Trump", "American rocket reaches the Moon. Very direct route. Nobody mentions the paperwork."),
    msg("Bezos", "We will continue aiming for landings where the vehicle remains eligible for another meeting."),
    msg("UN Admin", "The Moon received four tons. It did not sign for the package.", "system")
  ];
}

function easyJetDialogue() {
  return [
    msg("UN Admin", "New thread: Apollo agrees a £5.7 billion easyJet takeover. The ownership rules have requested a passport check.", "system"),
    msg("Apollo", "We are buying the airline, not changing the destination board."),
    msg("easyJet", "Passengers would appreciate if the destination board survives the transaction."),
    msg("EU Commission", "European airline ownership is not a carry-on item you can move between seats after boarding."),
    msg("Apollo", "We have advisers for the ownership structure."),
    msg("Passenger", "Do the advisers charge separately for selecting a structure near the front?"),
    msg("easyJet", "The low-cost model is not improved by turning the corporate chart into an optional extra."),
    msg("UK Treasury", "A £5.7 billion deal tends to make every regulator suddenly remember the same calendar."),
    msg("Meloni", "Europe can approve an airline purchase only after proving the purchaser is European enough to purchase the airline."),
    msg("Apollo", "We expected turbulence. We did not expect it before takeoff."),
    msg("UN Admin", "The airline changed owners. The baggage fee retained operational independence.", "system")
  ];
}

function tanSuitDialogue() {
  return [
    msg("UN Admin", "New thread: Obama and Larry David reopen the tan-suit controversy for television. National security remains beige.", "system"),
    msg("Obama", "I wore a suit. The country survived. Apparently the writers’ room did not move on."),
    msg("Larry David", "I saw an unresolved national trauma and thought: finally, affordable production design."),
    msg("Trump", "The suit was weak. Very low-energy color. Everybody knew it."),
    msg("Obama", "Thank you for proving the episode’s premise before it airs."),
    msg("Larry David", "Please stop generating free scenes. We have lawyers for that."),
    msg("Meloni", "America can turn beige fabric into a constitutional seminar. Impressive soft power."),
    msg("Trump", "My suits never needed a congressional hearing."),
    msg("Obama", "Several of the ties could have used bipartisan oversight."),
    msg("Larry David", "That is the show. Everybody go home."),
    msg("UN Admin", "The wardrobe controversy was renewed for another season.", "system")
  ];
}

function fifaDialogue() {
  return [
    msg("UN Admin", "New thread: FIFA leadership crisis and a collapsed commercial-rights proposal. The red card has entered the boardroom.", "system"),
    msg("Gianni Infantino", "Football needs investment, global reach and leadership that can move quickly."),
    msg("UEFA", "Moving quickly is not the same as moving a proposal before the members know what is being sold."),
    msg("Infantino", "The plan was designed to unlock value for the game."),
    msg("FIFA Council", "The phrase unlock value is usually when everyone checks whether the lock belongs to them."),
    msg("Trump", "The World Cup is enormous. Very valuable. You do not sell the best parts without a fantastic deal."),
    msg("UEFA", "The concern is not whether the rights are valuable. It is who decided the process was sufficient."),
    msg("Sponsor", "We purchased certainty and received a governance documentary."),
    msg("Infantino", "Criticism does not replace a viable commercial strategy."),
    msg("Meloni", "Neither does a commercial strategy replace consent from the people whose competition you are monetizing."),
    msg("UN Admin", "The proposal was withdrawn. The resignation calls remained on the fixture list.", "system")
  ];
}

function lebanonDialogue() {
  return [
    msg("UN Admin", "New thread: Israel-Lebanon talks continue after soldiers are killed and strikes return to southern Lebanon.", "system"),
    msg("Israel", "Talks cannot continue as if attacks on our soldiers are background noise."),
    msg("Lebanon", "And strikes across the south cannot be presented as punctuation in a peace process."),
    msg("U.S. Envoy", "Rome produced a channel. The channel now has to survive what happened after everyone left Rome."),
    msg("Israel", "A channel without enforcement becomes a place to file complaints after the next attack."),
    msg("Lebanon", "Enforcement that arrives only from the air is not a negotiated arrangement."),
    msg("Macron", "The diplomatic achievement was getting both sides into a room. The strategic failure is how quickly the battlefield reclaimed the agenda."),
    msg("Meloni", "Rome hosted talks, not a magic trick. Somebody still has to honor the terms outside the conference hall."),
    msg("Israel", "Security guarantees have to be measurable, not ceremonial."),
    msg("Lebanon", "So do limits on retaliation."),
    msg("UN Admin", "The talks stayed open. Southern Lebanon supplied the follow-up in smoke.", "system")
  ];
}

function aiDialogue() {
  return [
    msg("UN Admin", "New thread: AI capability announcement. Every participant has declared themselves the responsible adult.", "system"),
    msg("Sam Altman", "The model is more capable. The governance conversation is still catching up."),
    msg("Elon Musk", "Interesting definition of open. Also an interesting definition of safe."),
    msg("Trump", "We need the best American AI. It should know the answer before the question is finished."),
    msg("Xi", "Technology leadership is measured in infrastructure, not adjectives."),
    msg("Altman", "Infrastructure helps. Turning every benchmark into a sovereignty dispute does not."),
    msg("Musk", "Benchmarks are easier when the builder writes the test and grades it."),
    msg("Macron", "Europe prepared a regulation while the rest of you prepared a launch event."),
    msg("Trump", "Regulations do not launch. That is the problem with regulations."),
    msg("Xi", "The model has now observed ten definitions of control and selected none."),
    msg("UN Admin", "Human oversight is typing and has been typing for several releases.", "system")
  ];
}

function taylorDialogue() {
  return [
    msg("UN Admin", "New thread: Taylor Swift’s music leaves a Trump post. Copyright joined with counsel present.", "system"),
    msg("White House Comms", "The clip tested extremely well before the audio stopped being available."),
    msg("Taylor Swift", "My team reviewed the use. The silence is the rights holder responding."),
    msg("Trump", "The video was better with the song. That means the song benefited too."),
    msg("Swift", "That is not how licensing works, even when explained in all caps."),
    msg("Vance", "Was the removal automated or requested? The answer changes the communications plan."),
    msg("Swift", "My lawyers can discuss it in a format with fewer reaction emojis."),
    msg("White House Comms", "We are exploring alternate audio with fewer opinions."),
    msg("Obama", "This is what happens when campaign content meets an artist with organized metadata."),
    msg("Trump", "We will use a bigger song next time."),
    msg("UN Admin", "The post kept its views. The soundtrack exercised its right to remain silent.", "system")
  ];
}

function immigrationDialogue() {
  return [
    msg("UN Admin", "New thread: immigration polling. Every campaign highlighted a different cell in the spreadsheet.", "system"),
    msg("Trump", "The numbers show people want a strong border. Very clear."),
    msg("Obama", "They also show voters distinguish enforcement from chaos. Polls contain more than one row."),
    msg("Vance", "People are tired of a system that treats enforcement as an apology."),
    msg("AOC", "People are also tired of cruelty being marketed as operational efficiency."),
    msg("Trump", "They call borders cruel until the poll arrives."),
    msg("Obama", "And you call every inconvenient crosstab fake until it improves."),
    msg("Senate Staff", "We circulated the methodology. Nobody opened it, but reactions are strong."),
    msg("Meloni", "The poll has become a coalition government of selective reading."),
    msg("Vance", "Selective or not, the political message is that the status quo has no constituency."),
    msg("UN Admin", "The same survey was saved under four filenames beginning with DEFINITIVE.", "system")
  ];
}

export function dialogueNeedsRefinement(bundle, options = {}) {
  return dialogueProblems(bundle, options).length > 0;
}

export function buildDirectDialogue(bundle) {
  const headline = headlineText(bundle);
  if (/gaza|netanyahu.*peace plan|hamas.*disarm/.test(headline)) return gazaDialogue();
  if (/houthi|saudi.*refinery|refinery.*saudi/.test(headline)) return houthiSaudiDialogue();
  if (/ahrq|patient safety|hospital patients safe/.test(headline)) return healthcareAgencyDialogue();
  if (/frederick richard|fred richard|gymnastics/.test(headline)) return gymnasticsDialogue();
  if (/lisa cook|fed governor/.test(headline)) return fedCookDialogue();
  if (/tariff.*refund|refund.*tariff|liberation day/.test(headline)) return tariffRefundDialogue();
  if (/ukraine.*refiner|tatarstan|tyumen/.test(headline)) return ukraineRefineryDialogue();
  if (/secretary.general|rebeca grynspan|head of un/.test(headline)) return unSecretaryDialogue();
  if (/independent voters|progressive goals/.test(headline)) return independentVotersDialogue();
  if (/cybersecurity|cyber model|astra model/.test(headline)) return cyberModelDialogue();
  if (/moon|falcon|spacex/.test(headline)) return moonCrashDialogue();
  if (/easyjet|apollo.*airline/.test(headline)) return easyJetDialogue();
  if (/tan suit|larry david/.test(headline)) return tanSuitDialogue();
  if (/fifa|infantino/.test(headline)) return fifaDialogue();
  if (/lebanon/.test(headline)) return lebanonDialogue();
  if (/artificial intelligence|\bai\b|openai/.test(headline)) return aiDialogue();
  if (/taylor swift/.test(headline)) return taylorDialogue();
  if (/immigration|border|deport/.test(headline)) return immigrationDialogue();
  throw new Error("No approved deterministic conversation exists for this event; original dialogue generation is required.");
}

export function closingLineFor(bundle) {
  const headline = headlineText(bundle);
  if (/gaza|netanyahu.*peace plan|hamas.*disarm/.test(headline)) return "The roadmap had fifteen points. The disagreement found a sixteenth.";
  if (/houthi|saudi.*refinery|refinery.*saudi/.test(headline)) return "The defense pact was signed Friday. The refinery received the Sunday notification.";
  if (/ahrq|patient safety|hospital patients safe/.test(headline)) return "The checklist saved lives. The budget meeting asked whether it had a logo.";
  if (/frederick richard|fred richard|gymnastics/.test(headline)) return "Richard won by two points. The 2028 group chat started four years early.";
  if (/lisa cook|fed governor/.test(headline)) return "The Court protected Fed independence. The White House sent another letter anyway.";
  if (/tariff.*refund|refund.*tariff|liberation day/.test(headline)) return "$165 billion entered as policy. $100 billion left as a refund.";
  if (/ukraine.*refiner|tatarstan|tyumen/.test(headline)) return "Moscow called it an incident. Kyiv called it pressure. The refinery supplied the smoke.";
  if (/secretary.general|rebeca grynspan|head of un/.test(headline)) return "The ballot stayed secret. The five vetoes did not.";
  if (/independent voters|progressive goals/.test(headline)) return "The voters kept the policies and returned both labels to sender.";
  if (/cybersecurity|cyber model|astra model/.test(headline)) return "The model passed the benchmark. Judgment requested another test.";
  if (/moon|falcon|spacex/.test(headline)) return "The Moon received four tons. It did not sign for the package.";
  if (/easyjet|apollo.*airline/.test(headline)) return "The airline changed owners. The baggage fee retained operational independence.";
  if (/tan suit|larry david/.test(headline)) return "The suit was beige. The national memory remained high-contrast.";
  if (/fifa|infantino/.test(headline)) return "The proposal left the field. The resignation calls stayed on the fixture list.";
  if (/lebanon/.test(headline)) return "Rome hosted the talks. Southern Lebanon delivered the follow-up in smoke.";
  throw new Error("No approved deterministic closing line exists for this event; original dialogue generation is required.");
}
