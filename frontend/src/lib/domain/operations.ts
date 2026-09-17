import type { ReportKey } from "@/lib/api/types";

/**
 * The operations catalog. Every description here is written against what the
 * backend prompt actually asks the model to return (backend/services/claude.py)
 * and what the route actually does with the result (backend/routers/*). If you
 * change a prompt or a route, update the matching entry.
 */

export type OperationKind = "workflow" | "report" | "tool";
export type OperationCategory = "research" | "press" | "content" | "outreach" | "community" | "search";

export interface OperationDef {
  id: string;
  kind: OperationKind;
  category: OperationCategory;
  name: string;
  /** What you get, stated concretely. */
  produces: string;
  webResearch: boolean;
  /** Reads a web page you supply (the project URL by default). */
  readsPage: boolean;
  /** For reports: the project field the result is saved to. */
  reportKey?: ReportKey;
  /** For workflows: approving the result copies any email addresses into the Outbox as drafts. */
  draftsEmailsOnApproval?: boolean;
  /** Tags used when saving a result as a template, matching backend template lookup. */
  templateTags: string[];
}

export const CATEGORY_LABELS: Record<OperationCategory, string> = {
  research: "Research",
  press: "Press",
  content: "Content",
  outreach: "Outreach",
  community: "Communities & listings",
  search: "Search",
};

export const CATEGORY_ORDER: OperationCategory[] = ["research", "press", "content", "outreach", "community", "search"];

/** How each web research operation's description ends: its result lists the pages it relied on (the backend adds `sources`). */
const RESEARCH_SOURCES = "Lists the web pages the research relied on.";

export const OPERATIONS: OperationDef[] = [
  {
    id: "market_analysis",
    kind: "report",
    category: "research",
    name: "Market analysis",
    produces:
      `Executive summary, 8–10 key players, pricing benchmarks, differentiation, barriers to entry, three-year revenue scenarios and target customer segments. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    reportKey: "market_analysis",
    templateTags: ["research"],
  },
  {
    id: "pricing",
    kind: "report",
    category: "research",
    name: "Pricing strategy",
    produces: `Recommended pricing tiers with features, competitor prices, market insights and a launch pricing approach. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    reportKey: "pricing_result",
    templateTags: ["research"],
  },
  {
    id: "competitor",
    kind: "workflow",
    category: "research",
    name: "Competitor deep-dive",
    produces:
      `At least five named competitors, each with website, features, pricing, audience, strengths, weaknesses, a 1–10 threat level and how this project differs. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["research"],
  },
  {
    id: "trend",
    kind: "workflow",
    category: "research",
    name: "Trend report",
    produces: `Trends in this market with direction and relevance, plus key players, opportunities and threats. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["research"],
  },
  {
    id: "press_kit",
    kind: "report",
    category: "press",
    name: "Press kit",
    produces: "Boilerplate, 4–6 key features, target audience, founder bio, media assets to prepare and story angles for press.",
    webResearch: false,
    readsPage: true,
    reportKey: "press_kit",
    templateTags: ["content"],
  },
  {
    id: "press_release",
    kind: "report",
    category: "press",
    name: "Press release",
    produces:
      `Headline, subheadline and a full release in standard format, a distribution summary, researched outlets with submission details, and SEO keywords. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: true,
    reportKey: "press_release",
    templateTags: ["content"],
  },
  {
    id: "announcement",
    kind: "workflow",
    category: "press",
    name: "Launch announcement",
    produces: "One announcement written four ways: an email, a blog post, social posts per platform and a press-release version.",
    webResearch: false,
    readsPage: false,
    draftsEmailsOnApproval: true,
    templateTags: ["content", "social", "email"],
  },
  {
    id: "social_posts",
    kind: "workflow",
    category: "content",
    name: "Social posts",
    produces:
      "3–5 posts per channel with hashtags, post type and notes — for the channels marked In use in Settings, or X, LinkedIn and Instagram if none are.",
    webResearch: false,
    readsPage: false,
    templateTags: ["social", "content"],
  },
  {
    id: "ad_copy",
    kind: "workflow",
    category: "content",
    name: "Ad copy variants",
    produces: "A/B-ready ad variants, each with a headline, body, call to action, platform and target emotion.",
    webResearch: false,
    readsPage: false,
    templateTags: ["social", "content", "ads"],
  },
  {
    id: "blog",
    kind: "workflow",
    category: "content",
    name: "Blog post draft",
    produces: `Title, meta description, outline, the full draft, suggested keywords and a word count. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["content", "blog"],
  },
  {
    id: "repurpose",
    kind: "tool",
    category: "content",
    name: "Repurpose content",
    produces:
      "Your text rewritten for each channel you pick, with hashtags and notes. Results appear here and are not saved — copy them or save one as a template.",
    webResearch: false,
    readsPage: false,
    templateTags: ["social", "content"],
  },
  {
    id: "cold_outreach",
    kind: "workflow",
    category: "outreach",
    name: "Cold outreach emails",
    produces:
      "Personalized outreach emails, each with a subject, body and follow-up. The model writes the emails; it does not look up recipients.",
    webResearch: false,
    readsPage: false,
    draftsEmailsOnApproval: true,
    templateTags: ["outreach", "email"],
  },
  {
    id: "partnerships",
    kind: "workflow",
    category: "outreach",
    name: "Partnership scan",
    produces:
      `Named companies, creators and organizations to partner with, each with the partnership type, rationale, approach and potential value. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    draftsEmailsOnApproval: true,
    templateTags: ["outreach", "email"],
  },
  {
    id: "podcasts",
    kind: "workflow",
    category: "outreach",
    name: "Podcast guest spots",
    produces: `Podcasts that suit a founder guest spot, with host, website, audience size, relevance, a pitch angle and how to get in touch. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["outreach"],
  },
  {
    id: "reddit",
    kind: "workflow",
    category: "community",
    name: "Reddit communities",
    produces:
      `Relevant subreddits with subscriber counts, a rules summary, whether self-promotion is allowed, a suggested post and the best time to post. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["social", "community"],
  },
  {
    id: "directories",
    kind: "workflow",
    category: "community",
    name: "Free directories",
    produces: `Free listing directories with website, category, estimated traffic and how to submit. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["outreach"],
  },
  {
    id: "launch_platforms",
    kind: "workflow",
    category: "community",
    name: "Launch platforms",
    produces:
      `Where to launch — Product Hunt, Hacker News, Indie Hackers, BetaList and niche sites — with audience, preparation, best day, tips and priority. ${RESEARCH_SOURCES}`,
    webResearch: true,
    readsPage: false,
    templateTags: ["outreach", "community"],
  },
  {
    id: "seo",
    kind: "report",
    category: "search",
    name: "SEO metadata",
    produces:
      "Current and optimized scores, issues found, optimized title, description, Open Graph, Twitter Card, canonical and JSON-LD tags, and a paste-ready <head> block.",
    webResearch: false,
    readsPage: true,
    reportKey: "seo_result",
    templateTags: ["content"],
  },
];

const byId = new Map(OPERATIONS.map((op) => [op.id, op]));

export function getOperation(id: string): OperationDef | undefined {
  return byId.get(id);
}

/** Display name for a queue item's workflow id, including retired workflows. */
export function workflowName(workflowId: string): string {
  const op = byId.get(workflowId);
  if (op) return op.name;
  if (workflowId === "press_targets") return "Press targets (retired)";
  return workflowId.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export const REPORTS = OPERATIONS.filter((op): op is OperationDef & { reportKey: ReportKey } => Boolean(op.reportKey));

export function reportForKey(key: ReportKey) {
  return REPORTS.find((r) => r.reportKey === key);
}
