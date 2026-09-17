/**
 * Channels (social platforms). LaunchOps never posts on anyone's behalf; it
 * prepares copy and, where a platform supports it, opens that platform's own
 * composer. Each link below says exactly what it pre-fills.
 */

export interface ChannelDef {
  id: string;
  name: string;
}

export const CHANNELS: ChannelDef[] = [
  { id: "twitter", name: "X (Twitter)" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "instagram", name: "Instagram" },
  { id: "facebook", name: "Facebook" },
  { id: "reddit", name: "Reddit" },
  { id: "tiktok", name: "TikTok" },
  { id: "youtube", name: "YouTube" },
  { id: "threads", name: "Threads" },
];

export const DEFAULT_CHANNELS = ["twitter", "linkedin", "instagram"];

const ALIASES: Record<string, string> = {
  x: "twitter",
  twitterx: "twitter",
  xtwitter: "twitter",
  twitter: "twitter",
  linkedin: "linkedin",
  instagram: "instagram",
  ig: "instagram",
  facebook: "facebook",
  fb: "facebook",
  reddit: "reddit",
  tiktok: "tiktok",
  youtube: "youtube",
  threads: "threads",
};

export function channelId(platform: string | null | undefined): string | null {
  const key = (platform ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return ALIASES[key] ?? null;
}

export function channelName(platform: string | null | undefined): string {
  const id = channelId(platform);
  return CHANNELS.find((c) => c.id === id)?.name ?? (platform || "Channel");
}

export interface ComposeLink {
  href: string;
  label: string;
  /** True when the post text itself is pre-filled; false when only a link is shared. */
  prefillsText: boolean;
}

export function composeLink(platform: string | null | undefined, postText: string, projectUrl?: string): ComposeLink | null {
  const id = channelId(platform);
  const encodedText = encodeURIComponent(postText);
  const url = projectUrl?.trim();
  switch (id) {
    case "twitter":
      return { href: `https://x.com/intent/post?text=${encodedText}`, label: "Open in X", prefillsText: true };
    case "threads":
      return { href: `https://www.threads.net/intent/post?text=${encodedText}`, label: "Open in Threads", prefillsText: true };
    case "reddit": {
      const title = postText.split("\n")[0]?.slice(0, 280) ?? "";
      const params = new URLSearchParams({ title });
      if (url) params.set("url", url);
      return {
        href: `https://www.reddit.com/submit?${params.toString()}`,
        label: url ? "Submit link to Reddit" : "Open Reddit submit",
        prefillsText: false,
      };
    }
    case "linkedin":
      return url
        ? {
            href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            label: "Share project link on LinkedIn",
            prefillsText: false,
          }
        : null;
    case "facebook":
      return url
        ? {
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            label: "Share project link on Facebook",
            prefillsText: false,
          }
        : null;
    default:
      return null;
  }
}
