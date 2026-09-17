import { describe, expect, it } from "vitest";
import { channelName, composeLink } from "./channels";

// X, LinkedIn and Instagram compose links are covered in formatting.test.ts.

describe("channel names", () => {
  it("names a platform however the model spelled it", () => {
    expect(channelName("X")).toBe("X (Twitter)");
    expect(channelName("Twitter/X")).toBe("X (Twitter)");
    expect(channelName("fb")).toBe("Facebook");
    expect(channelName("YouTube")).toBe("YouTube");
  });

  it("keeps an unknown platform's own name, and says Channel when there is none", () => {
    expect(channelName("Mastodon")).toBe("Mastodon");
    expect(channelName("")).toBe("Channel");
    expect(channelName(null)).toBe("Channel");
  });
});

describe("compose links", () => {
  it("prefills the post on Threads", () => {
    expect(composeLink("threads", "Launch day! #audio")).toEqual({
      href: "https://www.threads.net/intent/post?text=Launch%20day!%20%23audio",
      label: "Open in Threads",
      prefillsText: true,
    });
  });

  it("submits the project link to Reddit, titled with the post's first line", () => {
    const link = composeLink("reddit", "We built a plugin builder\n\nDetails inside", " https://dsp.vybecod.example ");

    expect(link).toMatchObject({ label: "Submit link to Reddit", prefillsText: false });
    const params = new URL(link!.href).searchParams;
    expect(params.get("title")).toBe("We built a plugin builder");
    expect(params.get("url")).toBe("https://dsp.vybecod.example");
  });

  it("opens a plain Reddit submission when the project has no website, with the title cut to 280 characters", () => {
    const link = composeLink("reddit", "x".repeat(300));

    expect(link?.label).toBe("Open Reddit submit");
    const params = new URL(link!.href).searchParams;
    expect(params.get("title")).toHaveLength(280);
    expect(params.has("url")).toBe(false);
  });

  it("only shares the project link on Facebook, and only when there is one", () => {
    expect(composeLink("facebook", "Hi", "https://dsp.vybecod.example")).toEqual({
      href: "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdsp.vybecod.example",
      label: "Share project link on Facebook",
      prefillsText: false,
    });
    expect(composeLink("facebook", "Hi", "   ")).toBeNull();
  });

  it("has no composer for channels without a share link", () => {
    for (const platform of ["tiktok", "youtube", "mastodon", undefined]) {
      expect(composeLink(platform, "Hi", "https://dsp.vybecod.example")).toBeNull();
    }
  });
});
