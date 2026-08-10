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

export function buildDirectDialogue(bundle) {
  const text = headlineText(bundle);
  if (/israel.*election|election.*israel|jewish israelis.*election|october elections/.test(text)) return israelElectionDialogue();
  if (/spacex.*launch|launch.*spacex|rocket mission|rocket launch/.test(text) && !/crash|struck the moon|hit the moon/.test(text)) return launchDialogue();
  return buildBaseDialogue(bundle);
}

export function closingLineFor(bundle) {
  const text = headlineText(bundle);
  if (/israel.*election|election.*israel|october elections/.test(text)) return "The ballot boxes are not open yet. The trust deficit already is.";
  if (/spacex.*launch|launch.*spacex|rocket mission|rocket launch/.test(text) && !/crash|moon/.test(text)) return "The rocket completed the mission. The billionaire scoreboard requested an extension.";
  return baseClosingLineFor(bundle);
}

export { dialogueNeedsRefinement };
