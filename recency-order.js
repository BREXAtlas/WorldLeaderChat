"use strict";

(function installWorldLeaderChatNewestFirst(global) {
  if (!global || typeof global.allEvents !== "function") return;

  const MONTH_INDEX = new Map([
    ["january", 0], ["february", 1], ["march", 2], ["april", 3],
    ["may", 4], ["june", 5], ["july", 6], ["august", 7],
    ["september", 8], ["october", 9], ["november", 10], ["december", 11]
  ]);

  function displayDateValue(event) {
    const machine = String(event?.eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (machine) return Date.UTC(Number(machine[1]), Number(machine[2]) - 1, Number(machine[3]));

    const human = String(event?.date || "").trim().match(/^([A-Za-z]+)\s+(\d{1,2})(?:[–—-]\d{1,2})?,\s*(\d{4})$/);
    if (!human) return Number.NEGATIVE_INFINITY;
    const month = MONTH_INDEX.get(human[1].toLowerCase());
    return month === undefined ? Number.NEGATIVE_INFINITY : Date.UTC(Number(human[3]), month, Number(human[2]));
  }

  function timestamp(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function compareRecency(left, right) {
    const calendarDifference = displayDateValue(right) - displayDateValue(left);
    if (calendarDifference) return calendarDifference;

    const sourceDifference = timestamp(right?.editorial?.sourcePublishedAt) - timestamp(left?.editorial?.sourcePublishedAt);
    if (sourceDifference) return sourceDifference;

    const publicationDifference = timestamp(right?.publishedAt || right?.createdAt) - timestamp(left?.publishedAt || left?.createdAt);
    if (publicationDifference) return publicationDifference;

    return String(right?.id || right?.title || "").localeCompare(String(left?.id || left?.title || ""));
  }

  const originalAllEvents = global.allEvents;
  global.allEvents = function newestFirstEvents() {
    return [...originalAllEvents()].sort(compareRecency);
  };
  global.WLC_compareRecency = compareRecency;
})();
