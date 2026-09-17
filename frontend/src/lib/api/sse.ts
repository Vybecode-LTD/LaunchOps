/**
 * A parser for Server-Sent Events (text/event-stream), following the WHATWG HTML event stream rules.
 * The live updates stream is read with fetch rather than EventSource, because EventSource can't send
 * the Authorization and X-Org-Id headers, so the parsing EventSource would do happens here.
 *
 * Text arrives in chunks that can split anywhere: inside a field, between a CR and its LF, or in the
 * middle of an event. Lines end with LF, CR or CRLF; a blank line dispatches the event; lines starting
 * with a colon are comments (keep-alives); `retry:` sets the reconnection delay; several `data:` lines
 * join with newlines. An event cut off by the end of the stream is never dispatched.
 */

export interface ServerSentEvent {
  /** The event type: the `event:` field, or "message" when there isn't one. */
  event: string;
  data: string;
  /** The last event id the stream set (empty when it never set one). */
  id: string;
}

export interface SseHandlers {
  onEvent: (event: ServerSentEvent) => void;
  /** The stream asked for a different reconnection delay, in milliseconds. */
  onRetry?: (milliseconds: number) => void;
}

export interface SseParser {
  /** Parse the next chunk of decoded text. */
  push: (chunk: string) => void;
}

export function createSseParser({ onEvent, onRetry }: SseHandlers): SseParser {
  let buffer = "";
  let atStart = true;
  let skipLineFeed = false;
  let eventType = "";
  let data: string[] = [];
  let lastEventId = "";

  const dispatch = () => {
    if (data.length > 0) onEvent({ event: eventType || "message", data: data.join("\n"), id: lastEventId });
    data = [];
    eventType = "";
  };

  const processLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        data.push(value);
        break;
      case "id":
        if (!value.includes("\0")) lastEventId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) onRetry?.(Number(value));
        break;
      default:
      // Unknown fields are ignored.
    }
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      let text = chunk;
      if (atStart) {
        // A byte order mark may open the stream.
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        atStart = false;
      }
      if (skipLineFeed) {
        // The previous chunk ended with a CR, already taken as a line break: this LF completes the CRLF.
        if (text.startsWith("\n")) text = text.slice(1);
        skipLineFeed = false;
      }
      buffer += text;
      let lineStart = 0;
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (char !== "\n" && char !== "\r") continue;
        processLine(buffer.slice(lineStart, i));
        if (char === "\r") {
          if (i + 1 === buffer.length) skipLineFeed = true;
          else if (buffer[i + 1] === "\n") i += 1;
        }
        lineStart = i + 1;
      }
      buffer = buffer.slice(lineStart);
    },
  };
}
