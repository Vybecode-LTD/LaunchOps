import type { ActivityEntry, Brand, CalendarEvent, EmailItem, QueueItem, Template } from "../../src/lib/api/types";
import { addDays, toDateKey } from "../../src/lib/domain/dates";
import { RESEARCH_SOURCES, id, makeProject, makeState, type FakeInvitation, type FakeUsageRow } from "../../src/test/fakeApi";

/** The invitation link and password reset link the sample workspace's fake backend accepts. */
export const SAMPLE_INVITATION_TOKEN = "invite-sample-0123456789abcdefghijklmnop";
export const SAMPLE_RESET_TOKEN = "reset-sample-0123456789abcdefghijklmnopqr";

/**
 * A fictional portfolio with every kind of content the interface renders:
 * projects in each launch state, all five reports, results in every review
 * status (a research result and the market analysis with their sources), email
 * drafts, templates, ideas, calendar entries, a company, a pending invitation,
 * activity, and this month's AI usage against a budget.
 */
export function sampleWorkspace() {
  const today = toDateKey(new Date());
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

  const company: Brand = {
    id: "brand-vybecoding",
    name: "VybeCod.ing Ltd",
    tagline: "Tools for creative builders",
    tone: "creative",
    keywords: ["no-code", "audio"],
    avoid: ["cheap"],
    elevator: "VybeCod.ing builds tools that let creatives ship professional software.",
    company_name: "VybeCod.ing Ltd",
    industry: "Music technology",
    location: "London, UK",
    founded: "2024",
    founder_name: "Alex Morgan",
    founder_title: "Founder",
    phone: "",
    email: "press@vybecod.example",
    company_size: "2-10",
    boilerplate: "VybeCod.ing builds no-code tools for audio creators.",
    logo_url: "",
    created_at: "2026-09-01T10:00:00+00:00",
    updated_at: "2026-09-01T10:00:00+00:00",
  };

  const vybe = makeProject({
    name: "VybeCode DSP",
    launch_date: addDays(today, 11),
    brand_id: company.id,
    checklist: { "Pre-Launch_0": true, "Pre-Launch_1": true, "Pre-Launch_2": true, "Pre-Launch_3": true },
    email_settings: { smtp_host: "smtp.vybecod.invalid", smtp_port: 587, smtp_user: "launch@vybecod.example", from_name: "Alex Morgan", from_email: "launch@vybecod.example" },
    market_analysis: {
      generated_at: minutesAgo(60 * 26),
      executive_summary: "The no-code audio plugin market is growing as bedroom producers look for custom effects without learning C++.",
      key_players: [
        { name: "PatchForge", url: "https://patchforge.example", description: "Modular patching environment with a code export option." },
        { name: "KnobWorks", url: "https://knobworks.example", description: "Template-based effect builder for beginners." },
      ],
      pricing_benchmarks: {
        market_range_low: "$0",
        market_range_high: "$399",
        benchmark_table: [
          { competitor: "PatchForge", plan: "Pro", price: "$249" },
          { competitor: "KnobWorks", plan: "Studio", price: "$99" },
        ],
        positioning_recommendation: "Price below code-first tools and above template builders.",
      },
      differentiation: { summary: "The only builder with signed VST3 and AU export.", unique_advantages: [{ advantage: "Signed export" }, { advantage: "Visual node editor" }] },
      barriers_to_entry: [{ barrier: "DSP quality expectations", severity: "high" }],
      revenue_projections: {
        pricing_used: "Creator $12/mo, Pro $29/mo",
        scenarios: {
          conservative: { y1: "$180,000", y2: "$420,000", y3: "$760,000" },
          moderate: { y1: "$310,000", y2: "$840,000", y3: "$1.6M" },
          aggressive: { y1: "$520,000", y2: "$1.5M", y3: "$3.2M" },
        },
      },
      target_segments: [{ name: "Independent producers", priority: 1 }],
      sources: RESEARCH_SOURCES,
    },
    pricing_result: {
      generated_at: minutesAgo(60 * 30),
      tiers: [
        { name: "Creator", price: "$12/mo", features: ["Unlimited projects", "VST3 export"] },
        { name: "Pro", price: "$29/mo", features: ["Signed AU export", "Preset marketplace"], recommended: true },
      ],
      launch_strategy: "Offer 40% off annual plans during launch week.",
      insights: ["Annual plans convert better for tools used weekly."],
    },
    press_kit: {
      generated_at: minutesAgo(60 * 50),
      source_url: "https://dsp.vybecod.example",
      boilerplate: "VybeCode DSP lets producers design audio plugins visually.",
      key_features: ["Node-based editor", "Signed export"],
      target_audience: "Independent producers and sound designers",
      suggested_angles: ["No-code comes to audio"],
    },
    press_release: {
      generated_at: minutesAgo(60 * 20),
      headline: "VybeCode DSP brings no-code plugin design to producers",
      subheadline: "Build and export VST3 and AU plugins without writing code",
      body: "**LONDON** — VybeCod.ing today announced VybeCode DSP, a visual builder for audio plugins.",
      summary: "A visual builder for VST3 and AU plugins.",
      suggested_distribution: [{ name: "Synth Weekly", type: "industry_publication", contact_email: "tips@synthweekly.example" }],
      seo_keywords: ["audio plugin builder"],
    },
    seo_result: {
      generated_at: minutesAgo(60 * 70),
      source_url: "https://dsp.vybecod.example",
      current_score: 54,
      optimized_score: 88,
      issues: ["No meta description", "Missing Open Graph image"],
      optimized: { title: "VybeCode DSP — Build audio plugins without code", description: "Design, test and export VST3 and AU plugins visually." },
      head_block: '<title>VybeCode DSP — Build audio plugins without code</title>\n<meta name="description" content="Design, test and export VST3 and AU plugins visually.">',
    },
  });
  const orbit = makeProject({ name: "Orbit Payroll", project_type: "service", color: "#2f7fd0", launch_date: addDays(today, 6), tagline: "Payroll for remote teams" });
  const tessera = makeProject({ name: "Tessera Health", color: "#3f8f4f", launch_date: addDays(today, -2), tagline: "Clinic scheduling" });
  const fieldnote = makeProject({ name: "Fieldnote", color: "#179a8c", status: "launched", launch_date: addDays(today, -21), tagline: "Research notes that write themselves" });

  const queueItem = (overrides: Partial<QueueItem>): QueueItem => ({
    id: id("queue"),
    product_id: vybe.id,
    workflow_id: "social_posts",
    status: "pending",
    content: {},
    preview: "",
    input_params: "",
    notes: "",
    created_at: minutesAgo(90),
    ...overrides,
  });
  const queue: QueueItem[] = [
    queueItem({ workflow_id: "blog", status: "running", created_at: minutesAgo(2) }),
    queueItem({
      workflow_id: "cold_outreach",
      preview: "Drafted 2 outreach emails",
      content: { emails: [{ subject: "A plugin you could build in an afternoon", body: "Hi Dana, ...", target_type: "Journalist", recipient_email: "dana@synthweekly.example" }] },
    }),
    queueItem({
      workflow_id: "competitor",
      preview: "Analyzed 2 competitors · highest threat 7/10",
      content: {
        competitors: [{ name: "PatchForge", threat_level: 7, strengths: ["Community"], weaknesses: ["No signed export"] }, { name: "KnobWorks", threat_level: 3 }],
        sources: RESEARCH_SOURCES,
      },
      created_at: minutesAgo(200),
    }),
    queueItem({ workflow_id: "social_posts", status: "approved", preview: "Generated 2 social posts", content: { posts: [{ platform: "twitter", content: "Launch day is close.", hashtags: ["#vst3"] }] } }),
    queueItem({ workflow_id: "ad_copy", status: "rejected", preview: "Generated 1 ad sets", content: { ad_sets: [{ variant: "A", headline: "Build plugins without code", cta: "Start free" }] } }),
    queueItem({ workflow_id: "partnerships", status: "failed", content: { error: "Claude API error 529: overloaded" }, input_params: "Focus on DAW makers" }),
  ];

  const draft = (overrides: Partial<EmailItem>): EmailItem => ({
    id: id("email"),
    product_id: vybe.id,
    source_queue_id: null,
    recipient_name: "Dana Whitfield",
    recipient_email: "dana@synthweekly.example",
    subject: "A plugin you could build in an afternoon",
    body: "Hi Dana,\n\nWe built a visual way to design audio plugins.",
    status: "pending",
    error: "",
    sent_at: null,
    created_at: minutesAgo(80),
    ...overrides,
  });
  const emails = [
    draft({}),
    draft({ recipient_name: "Priya Raman", recipient_email: "priya@mixdown.example", subject: "Early access for Mixdown readers" }),
    draft({ recipient_name: "Leo Hart", recipient_email: "leo@beatlab.example", status: "sent", sent_at: minutesAgo(600) }),
  ];

  const templates: Template[] = [
    { id: id("template"), name: "Journalist intro", type: "email", tags: ["outreach", "email"], content: "Hi {name}, ...", source_product: "", created_at: minutesAgo(5000) },
    { id: id("template"), name: "Launch thread", type: "social", tags: ["social", "content"], content: "Today we launch ...", source_product: "", created_at: minutesAgo(4000) },
  ];
  const captures = [
    { id: id("capture"), text: "Reddit AMA in launch week", product_id: vybe.id, created_at: minutesAgo(300) },
    { id: id("capture"), text: "Ask beta testers for quotes", product_id: orbit.id, created_at: minutesAgo(900) },
  ];
  const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
    id: id("event"),
    date: today,
    product_id: vybe.id,
    product_name: vybe.name,
    platform: "twitter",
    title: "Teaser clip",
    color: vybe.color,
    ...overrides,
  });
  const calendar = [
    event({ date: addDays(today, 1), title: "Teaser clip: building a filter in 60 seconds" }),
    event({ date: addDays(today, 3), title: "AMA prep", platform: "reddit" }),
    event({ date: addDays(today, 4), title: "Customer story", product_id: orbit.id, product_name: orbit.name, platform: "linkedin", color: orbit.color }),
  ];

  const invitation: FakeInvitation = {
    id: id("invitation"),
    org_id: "org-1",
    organisation: "Northstar Ventures",
    email: "priya@lumen.example",
    role: "editor",
    invited_by: "Jordan Avery",
    token: SAMPLE_INVITATION_TOKEN,
    status: "pending",
    created_at: minutesAgo(120),
    expires_at: new Date(now + 6 * 86_400_000).toISOString(),
  };

  const logEntry = (n: number, action: string, summary: string): ActivityEntry & { org_id: string } => ({
    id: n,
    org_id: "org-1",
    actor: "jordan@northstar.example",
    action,
    target_type: "",
    target_id: "",
    summary,
    details: {},
    created_at: minutesAgo(n * 45),
  });
  const activity = [
    logEntry(3, "result.approved", "Approved “Generated 2 social posts” for VybeCode DSP"),
    logEntry(2, "organisation.budget_changed", "Set the monthly AI budget to $50.00"),
    logEntry(1, "invitation.created", "Invited priya@lumen.example as Editor"),
  ];

  // This month's AI usage: $41.27 of a $50 budget, with one call on a model without a known price.
  const spend = (overrides: Partial<FakeUsageRow>): FakeUsageRow => ({
    org_id: "org-1",
    created_at: new Date(now - 60_000).toISOString(),
    user_id: "user-1",
    product_id: vybe.id,
    operation: "market_analysis",
    model: "claude-sonnet-5",
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    web_search_requests: 0,
    cost_usd: 0,
    ...overrides,
  });
  const aiUsage = [
    spend({ input_tokens: 120_000, output_tokens: 18_000, cache_creation_input_tokens: 4_000, cache_read_input_tokens: 60_000, web_search_requests: 12, cost_usd: 30.12 }),
    spend({ operation: "competitor", product_id: orbit.id, user_id: "user-2", input_tokens: 40_000, output_tokens: 9_000, web_search_requests: 5, cost_usd: 11.15 }),
    spend({ operation: "blog", model: "claude-preview-x", input_tokens: 8_000, output_tokens: 3_000, cost_usd: null }),
  ];

  const state = makeState({
    projects: [vybe, orbit, tessera, fieldnote],
    queue,
    emails,
    templates,
    captures,
    calendar,
    brands: [company],
    smtpPasswords: { [vybe.id]: "app-password" },
    invitations: [invitation],
    activity,
    aiUsage,
    budgets: { "org-1": 50 },
    passwordResets: { [SAMPLE_RESET_TOKEN]: "jordan@northstar.example" },
  });
  return { state, today, projects: { vybe, orbit, tessera, fieldnote }, queue, emails, calendar };
}
