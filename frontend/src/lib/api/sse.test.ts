import { describe, expect, it } from "vitest";
import { createSseParser, type ServerSentEvent } from "./sse";

/** Feed the chunks to a new parser; returns what it dispatched and the retry delays it announced. */
function parse(...chunks: string[]) {
  const events: ServerSentEvent[] = [];
  const retries: number[] = [];
  const parser = createSseParser({ onEvent: (event) => events.push(event), onRetry: (ms) => retries.push(ms) });
  chunks.forEach((chunk) => parser.push(chunk));
  return { events, retries };
}

const QUEUE_EVENT = 'event: queue\ndata: {"id":"queue-1","status":"pending"}\n\n';

describe("Server-Sent Events parser", () => {
  it("reads the backend's stream: a retry delay, keep-alive comments and named events", () => {
    const { events, retries } = parse(`retry: 5000\n\n: keep-alive\n\n${QUEUE_EVENT}event: email\ndata: {"id":"email-1","status":"sent"}\n\n`);

    expect(retries).toEqual([5000]);
    expect(events).toEqual([
      { event: "queue", data: '{"id":"queue-1","status":"pending"}', id: "" },
      { event: "email", data: '{"id":"email-1","status":"sent"}', id: "" },
    ]);
  });

  it("puts an event back together however the chunks split it", () => {
    const whole = parse(QUEUE_EVENT).events;
    for (let size = 1; size < QUEUE_EVENT.length; size++) {
      const chunks = QUEUE_EVENT.match(new RegExp(`[\\s\\S]{1,${size}}`, "g"))!;
      expect(parse(...chunks).events, `chunks of ${size}`).toEqual(whole);
    }
  });

  it("accepts CRLF, CR and LF line endings, including a CRLF split between chunks", () => {
    const expected = [{ event: "queue", data: "a", id: "" }];
    expect(parse("event: queue\r\ndata: a\r\n\r\n").events).toEqual(expected);
    expect(parse("event: queue\rdata: a\r\r").events).toEqual(expected);
    expect(parse("event: queue\r", "\ndata: a\r", "\n\r", "\n").events).toEqual(expected);
    // The CR ending a chunk is a line break on its own when no LF follows.
    expect(parse("event: queue\r", "data: a\r", "\r").events).toEqual(expected);
  });

  it("joins data lines with newlines and keeps an empty data line", () => {
    expect(parse("data: first\ndata:second\ndata\n\n").events).toEqual([{ event: "message", data: "first\nsecond\n", id: "" }]);
    expect(parse("data:\n\n").events).toEqual([{ event: "message", data: "", id: "" }]);
  });

  it("strips exactly one space after the colon", () => {
    expect(parse("data:  indented\n\n").events[0]?.data).toBe(" indented");
  });

  it("ignores comments, unknown fields, events without data and a bad retry value", () => {
    const { events, retries } = parse(": comment\nfoo: bar\nevent: queue\n\nretry: soon\nretry: 5s\n\n");
    expect(events).toEqual([]);
    expect(retries).toEqual([]);
  });

  it("forgets the event type once an event is dispatched or discarded", () => {
    expect(parse("event: queue\n\ndata: x\n\n").events).toEqual([{ event: "message", data: "x", id: "" }]);
  });

  it("remembers the last event id, but not one containing NULL", () => {
    const { events } = parse("id: 7\ndata: a\n\nid: bad\0id\ndata: b\n\n");
    expect(events.map((e) => e.id)).toEqual(["7", "7"]);
  });

  it("never dispatches an event the stream cut off", () => {
    expect(parse('event: queue\ndata: {"id":"queue-1"}\n').events).toEqual([]);
  });

  it("skips a byte order mark at the start of the stream only", () => {
    expect(parse("﻿data: a\n\n").events).toEqual([{ event: "message", data: "a", id: "" }]);
    expect(parse("", "﻿data: a\n\n").events).toEqual([{ event: "message", data: "a", id: "" }]);
    expect(parse("data: a\n\n", "﻿data: b\n\n").events.map((e) => e.event)).toEqual(["message"]);
  });
});
