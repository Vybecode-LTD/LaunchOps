import { useState } from "react";
import { channelName, composeLink } from "@/lib/domain/channels";
import { toMarkdown } from "@/lib/domain/exporters";
import { orderedEntries } from "@/lib/domain/order";
import { dicts, humanizeKey, isDict, list, numberFrom, strings, text, type Dict } from "@/lib/domain/values";
import { Button } from "@/components/ui/Button";
import { CopyButton, Notice, Segmented } from "@/components/ui/Display";
import { Markdown } from "@/components/ui/Markdown";
import { Pill } from "@/components/ui/Pill";
import { Bullets, Card, Chips, ExternalLink, KeyValues, Prose, Section, Sources, Threat } from "./primitives";
import styles from "./Results.module.css";

interface Props {
  workflowId: string;
  content: unknown;
  projectUrl?: string;
}

/** Renders a workflow result by its workflow id, falling back to a generic view, and ends with any sources its research relied on. */
export function WorkflowResult({ workflowId, content, projectUrl }: Props) {
  if (!isDict(content)) {
    return <GenericResult content={content} />;
  }
  if (text(content.error)) {
    return <Notice tone="crit">This operation failed: {text(content.error)}</Notice>;
  }
  // Only results stored before results were validated can be unstructured.
  if (text(content.raw_response)) {
    return (
      <div className={styles.doc}>
        <Notice tone="warn">The model's reply couldn't be structured, so it is shown as text. Run the operation again to try for a structured result.</Notice>
        <Markdown>{text(content.raw_response)}</Markdown>
      </div>
    );
  }
  return (
    <div className={styles.doc}>
      <WorkflowBody workflowId={workflowId} content={content} projectUrl={projectUrl} />
      <Sources result={content} />
    </div>
  );
}

function WorkflowBody({ workflowId, content, projectUrl }: Props & { content: Dict }) {
  switch (workflowId) {
    case "competitor":
      return <Competitors content={content} />;
    case "trend":
      return <Trends content={content} />;
    case "cold_outreach":
      return <OutreachEmails content={content} />;
    case "partnerships":
      return <Partnerships content={content} />;
    case "social_posts":
      return <SocialPosts content={content} projectUrl={projectUrl} />;
    case "ad_copy":
      return <AdCopy content={content} />;
    case "blog":
      return <BlogPost content={content} />;
    case "announcement":
      return <Announcement content={content} />;
    case "reddit":
      return <Reddit content={content} />;
    case "directories":
      return <Directories content={content} />;
    case "launch_platforms":
      return <LaunchPlatforms content={content} />;
    case "podcasts":
      return <Podcasts content={content} />;
    default:
      return <GenericResult content={content} kind={workflowId} />;
  }
}

function Empty({ what }: { what: string }) {
  return <Notice>The result doesn't contain any {what}. Run the operation again, perhaps with more specific instructions.</Notice>;
}

/* ─── Research ─── */

function Competitors({ content }: { content: Dict }) {
  const competitors = dicts(content.competitors);
  if (!competitors.length) return <GenericResult content={content} />;
  const sorted = [...competitors].sort((a, b) => (numberFrom(b.threat_level) ?? -1) - (numberFrom(a.threat_level) ?? -1));
  // Research does not always turn these up. A column no competitor fills is left out rather
  // than rendered as a header over blank cells.
  const columns = ([["pricing", "Pricing"], ["audience", "Audience"]] as const).filter(([key]) =>
    sorted.some((c) => text(c[key])),
  );
  return (
    <div className={styles.doc}>
      <Section title="Competitors" count={competitors.length}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="placard">Competitor</th>
                <th className="placard">Threat</th>
                {columns.map(([key, label]) => (
                  <th key={key} className="placard">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{text(c.name) || "Unnamed"}</div>
                    <ExternalLink href={c.url} />
                  </td>
                  <td>
                    <Threat value={c.threat_level} />
                  </td>
                  {columns.map(([key]) => (
                    <td key={key}>{text(c[key]) || <span className={styles.muted}>Not found</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Profiles">
        <div className={`${styles.cards} ${styles.cardsWide}`}>
          {sorted.map((c, i) => (
            <Card key={i} title={text(c.name) || "Unnamed"} sub={<ExternalLink href={c.url} />} aside={<Threat value={c.threat_level} />}>
              {text(c.overview) && <p className={styles.cardText}>{text(c.overview)}</p>}
              {(strings(c.strengths).length > 0 || strings(c.weaknesses).length > 0) && (
                <div className={styles.twoCol}>
                  {strings(c.strengths).length > 0 && (
                    <div>
                      <div className="placard" style={{ marginBottom: 6 }}>
                        Strengths
                      </div>
                      <Bullets items={strings(c.strengths)} />
                    </div>
                  )}
                  {strings(c.weaknesses).length > 0 && (
                    <div>
                      <div className="placard" style={{ marginBottom: 6 }}>
                        Weaknesses
                      </div>
                      <Bullets items={strings(c.weaknesses)} />
                    </div>
                  )}
                </div>
              )}
              {strings(c.features).length > 0 && <Chips items={strings(c.features)} />}
              {text(c.differentiation) && (
                <KeyValues rows={[["How we differ", text(c.differentiation)]]} />
              )}
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Trends({ content }: { content: Dict }) {
  const trends = dicts(content.trends);
  return (
    <div className={styles.doc}>
      <Section title="Trends" count={trends.length}>
        {trends.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Trend</th>
                  <th className="placard">Direction</th>
                  <th className="placard">Relevance</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{text(t.name)}</div>
                      <div style={{ color: "var(--ink-2)" }}>{text(t.description)}</div>
                    </td>
                    <td>{humanizeKey(text(t.direction))}</td>
                    <td>{text(t.relevance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty what="trends" />
        )}
      </Section>
      <div className={styles.threeCol}>
        <Section title="Key players">
          <Bullets items={listish(content.key_players)} />
        </Section>
        <Section title="Opportunities">
          <Bullets items={listish(content.opportunities)} />
        </Section>
        <Section title="Threats">
          <Bullets items={listish(content.threats)} />
        </Section>
      </div>
    </div>
  );
}

/** A value that may be a string, a list of strings, or a list of objects with names. */
function listish(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return list(value)
    .map((v) => (isDict(v) ? [text(v.name), text(v.description)].filter(Boolean).join(" — ") : text(v)))
    .filter(Boolean);
}

/* ─── Outreach ─── */

function OutreachEmails({ content }: { content: Dict }) {
  const emails = dicts(content.emails);
  if (!emails.length) return <Empty what="emails" />;
  return (
    <div className={styles.doc}>
      <Section title="Emails" count={emails.length}>
        <div className={`${styles.cards} ${styles.cardsWide}`}>
          {emails.map((email, i) => {
            const full = `Subject: ${text(email.subject)}\n\n${text(email.body)}`;
            const followUp = text(email.follow_up_body);
            return (
              <article key={i} className={styles.email}>
                <dl className={styles.emailHead}>
                  <dt>For</dt>
                  <dd>{text(email.target_type) || "Recipient"}</dd>
                  <dt>Subject</dt>
                  <dd>{text(email.subject)}</dd>
                </dl>
                <div className={styles.emailBody}>{text(email.body)}</div>
                {followUp && (
                  <details className={styles.followUp}>
                    <summary>Follow-up · {text(email.follow_up_subject) || "no subject"}</summary>
                    <div className={styles.emailBody}>{followUp}</div>
                  </details>
                )}
                <div className={styles.emailFoot} data-print="hide">
                  <CopyButton value={full} label="Copy email" variant="secondary" />
                  {followUp && (
                    <CopyButton value={`Subject: ${text(email.follow_up_subject)}\n\n${followUp}`} label="Copy follow-up" />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Partnerships({ content }: { content: Dict }) {
  const items = dicts(content.partnerships);
  if (!items.length) return <Empty what="partnership opportunities" />;
  return (
    <div className={styles.doc}>
      <Section title="Partnership opportunities" count={items.length}>
        <div className={styles.cards}>
          {items.map((p, i) => (
            <Card key={i} title={text(p.name) || "Unnamed"} sub={text(p.type)}>
              <KeyValues
                rows={[
                  ["Why", text(p.rationale)],
                  ["Approach", text(p.approach)],
                  ["Potential value", text(p.potential_value)],
                ]}
              />
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Podcasts({ content }: { content: Dict }) {
  const items = dicts(content.podcasts);
  if (!items.length) return <Empty what="podcasts" />;
  return (
    <div className={styles.doc}>
      <Section title="Podcasts" count={items.length}>
        <div className={styles.cards}>
          {items.map((p, i) => (
            <Card key={i} title={text(p.name) || "Unnamed"} sub={text(p.host) ? `Hosted by ${text(p.host)}` : undefined} aside={<ExternalLink href={p.url} />}>
              <KeyValues
                rows={[
                  ["Audience", text(p.audience_size)],
                  ["Relevance", text(p.relevance)],
                  ["Pitch angle", text(p.pitch_angle)],
                  ["Contact", text(p.contact_method)],
                ]}
              />
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ─── Content ─── */

function SocialPosts({ content, projectUrl }: { content: Dict; projectUrl?: string }) {
  const posts = dicts(content.posts);
  if (!posts.length) return <Empty what="posts" />;
  const groups = new Map<string, Dict[]>();
  for (const post of posts) {
    const key = channelName(text(post.platform));
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }
  return (
    <div className={styles.doc}>
      {[...groups.entries()].map(([channel, channelPosts]) => (
        <Section key={channel} title={channel} count={channelPosts.length}>
          <div className={styles.cards}>
            {channelPosts.map((post, i) => {
              const hashtags = Array.isArray(post.hashtags) ? strings(post.hashtags).join(" ") : text(post.hashtags);
              const full = [text(post.content), hashtags].filter(Boolean).join("\n\n");
              const compose = composeLink(text(post.platform), full, projectUrl);
              return (
                <Card
                  key={i}
                  title={text(post.post_type) || `Post ${i + 1}`}
                  aside={<span className="placard num">{full.length} chars</span>}
                  footer={
                    <span data-print="hide" style={{ display: "contents" }}>
                      <CopyButton value={full} label="Copy post" variant="secondary" />
                      {compose && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={compose.href} target="_blank" rel="noopener noreferrer" title={compose.prefillsText ? "Opens with this text filled in" : "Shares the project link only — copy the text first"}>
                            {compose.label}
                          </a>
                        </Button>
                      )}
                    </span>
                  }
                >
                  <p className={styles.cardText} style={{ color: "var(--ink)" }}>
                    {text(post.content)}
                  </p>
                  {hashtags && <div style={{ fontSize: "var(--text-13)", color: "var(--signal-ink)" }}>{hashtags}</div>}
                  {text(post.notes) && <div className={styles.cardSub}>{text(post.notes)}</div>}
                </Card>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}

function AdCopy({ content }: { content: Dict }) {
  const ads = dicts(content.ad_sets);
  if (!ads.length) return <Empty what="ad variants" />;
  return (
    <div className={styles.doc}>
      <Section title="Ad variants" count={ads.length}>
        <div className={styles.cards}>
          {ads.map((ad, i) => {
            const full = [text(ad.headline), text(ad.body), text(ad.cta)].filter(Boolean).join("\n\n");
            return (
              <Card
                key={i}
                title={text(ad.headline) || `Variant ${i + 1}`}
                sub={[text(ad.variant) && `Variant ${text(ad.variant)}`, text(ad.platform)].filter(Boolean).join(" · ")}
                footer={<CopyButton value={full} label="Copy ad" variant="secondary" />}
              >
                <p className={styles.cardText}>{text(ad.body)}</p>
                <KeyValues
                  rows={[
                    ["Call to action", text(ad.cta)],
                    ["Target emotion", text(ad.target_emotion)],
                  ]}
                />
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function BlogPost({ content }: { content: Dict }) {
  const title = text(content.title);
  const body = text(content.full_content);
  const article = `# ${title}\n\n${body}`;
  return (
    <div className={styles.doc}>
      <Section title="Article" copy={article}>
        {title && <h3 className={styles.headline}>{title}</h3>}
        <KeyValues
          rows={[
            ["Meta description", text(content.meta_description)],
            ["Word count", text(content.word_count)],
          ]}
        />
        {body ? <Markdown>{body}</Markdown> : <Empty what="article text" />}
      </Section>
      <div className={styles.twoCol}>
        <Section title="Outline">
          <Bullets items={strings(content.outline)} />
        </Section>
        <Section title="Suggested keywords">
          <Chips items={strings(content.suggested_keywords)} />
        </Section>
      </div>
    </div>
  );
}

function Announcement({ content }: { content: Dict }) {
  const social = isDict(content.social_versions) ? content.social_versions : {};
  const versions: Array<{ key: string; label: string; body: string }> = [
    { key: "email", label: "Email", body: text(content.email_version) },
    { key: "blog", label: "Blog", body: text(content.blog_version) },
    { key: "press", label: "Press release", body: text(content.press_release_version) },
    ...Object.entries(social).map(([platform, value]) => ({
      key: `social-${platform}`,
      label: channelName(platform),
      body: isDict(value) ? toMarkdown(value, channelName(platform)) : text(value),
    })),
  ].filter((v) => v.body);
  const [active, setActive] = useState(versions[0]?.key ?? "");
  const current = versions.find((v) => v.key === active) ?? versions[0];
  if (!current) return <Empty what="announcement versions" />;
  return (
    <div className={styles.doc}>
      <Section title="Versions" count={versions.length} copy={current.body}>
        <div className={styles.versionTabs} data-print="hide">
          <Segmented label="Version" value={current.key} onChange={setActive} options={versions.map((v) => ({ value: v.key, label: v.label }))} />
        </div>
        <Markdown>{current.body}</Markdown>
      </Section>
    </div>
  );
}

/* ─── Communities & listings ─── */

/** Whether a community allows self-promotion: "yes", "no" or "limited" (only in some posts, threads or days); older results wrote it freely. */
function selfPromo(value: unknown) {
  if (value === true || /^(yes|true|allowed)/i.test(text(value))) return <Pill tone="ok">Allowed</Pill>;
  if (value === false || /^(no|false|not)/i.test(text(value))) return <Pill tone="crit">Not allowed</Pill>;
  if (/^limited/i.test(text(value))) return <Pill tone="warn">Limited</Pill>;
  return <Pill tone="neutral">{text(value) || "Unclear"}</Pill>;
}

function Reddit({ content }: { content: Dict }) {
  const communities = dicts(content.communities);
  if (!communities.length) return <Empty what="communities" />;
  return (
    <div className={styles.doc}>
      <Notice>Subscriber counts and rules come from web research at the time of the run. Check each community's current rules before posting.</Notice>
      <Section title="Communities" count={communities.length}>
        <div className={`${styles.cards} ${styles.cardsWide}`}>
          {communities.map((c, i) => {
            const name = text(c.subreddit).replace(/^\/?r\//i, "");
            return (
              <Card
                key={i}
                title={name ? `r/${name}` : "Community"}
                sub={[text(c.subscribers) && `${text(c.subscribers)} subscribers`, text(c.best_time) && `Best time: ${text(c.best_time)}`].filter(Boolean).join(" · ")}
                aside={selfPromo(c.self_promo_allowed)}
                footer={
                  <>
                    {name && <ExternalLink href={`https://www.reddit.com/r/${name}/`}>Open r/{name}</ExternalLink>}
                    {text(c.suggested_post) && <CopyButton value={text(c.suggested_post)} label="Copy suggested post" />}
                  </>
                }
              >
                <KeyValues
                  rows={[
                    ["Relevance", text(c.relevance)],
                    ["Rules", text(c.rules_summary)],
                    ["Post type", text(c.post_type)],
                  ]}
                />
                {text(c.suggested_post) && (
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: "var(--text-13)", color: "var(--ink-2)" }}>Suggested post</summary>
                    <p className={styles.cardText} style={{ marginTop: 8 }}>
                      {text(c.suggested_post)}
                    </p>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Directories({ content }: { content: Dict }) {
  const items = dicts(content.directories);
  if (!items.length) return <Empty what="directories" />;
  return (
    <div className={styles.doc}>
      <Section title="Directories" count={items.length}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="placard">Directory</th>
                <th className="placard">Category</th>
                <th className="placard">Cost</th>
                <th className="placard">Traffic</th>
                <th className="placard">How to submit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{text(d.name)}</div>
                    <ExternalLink href={d.url} />
                  </td>
                  <td>{text(d.category)}</td>
                  <td>{d.is_free === true || /^(yes|true|free)/i.test(text(d.is_free)) ? <Pill tone="ok">Free</Pill> : <Pill tone="neutral">{text(d.is_free) === "false" || d.is_free === false ? "Paid" : text(d.is_free) || "Unknown"}</Pill>}</td>
                  <td>{text(d.estimated_traffic)}</td>
                  <td>
                    {text(d.submission_process)}
                    {text(d.notes) && <div style={{ color: "var(--ink-3)", marginTop: 4 }}>{text(d.notes)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/** "High priority" for the backend's high, medium and low; "Priority 2" for a number; "Priority: <text>" for older free text. */
function priorityLabel(value: unknown): string {
  const t = text(value);
  if (!t) return "";
  if (/^(high|medium|low)$/i.test(t)) return `${humanizeKey(t.toLowerCase())} priority`;
  if (/^\d+(\.\d+)?$/.test(t)) return `Priority ${t}`;
  if (/\bpriority\b/i.test(t)) return humanizeKey(t);
  return `Priority: ${t}`;
}

function LaunchPlatforms({ content }: { content: Dict }) {
  const items = dicts(content.platforms);
  if (!items.length) return <Empty what="launch platforms" />;
  const priorityRank = (v: unknown) => {
    const t = text(v).toLowerCase();
    const n = numberFrom(v);
    if (n !== null) return n;
    return t.startsWith("high") ? 1 : t.startsWith("med") ? 2 : t.startsWith("low") ? 3 : 4;
  };
  const sorted = [...items].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  return (
    <div className={styles.doc}>
      <Section title="Launch platforms" count={items.length}>
        <div className={styles.cards}>
          {sorted.map((p, i) => (
            <Card
              key={i}
              title={text(p.name) || "Platform"}
              sub={<ExternalLink href={p.url} />}
              aside={text(p.priority) ? <Pill tone="outline" dot={false}>{priorityLabel(p.priority)}</Pill> : undefined}
            >
              <KeyValues
                rows={[
                  ["Audience", text(p.audience)],
                  ["Preparation", text(p.prep_required)],
                  ["Best day", text(p.best_day)],
                  ["Tips", Array.isArray(p.tips) ? strings(p.tips).join("\n") : text(p.tips)],
                ]}
              />
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ─── Generic ─── */

/** Any result as labelled sections, for workflows without a view of their own. Sources are left to the Sources section. */
export function GenericResult({ content, kind }: { content: unknown; kind?: string }) {
  if (typeof content === "string") return <Markdown>{content}</Markdown>;
  if (!isDict(content)) return <Notice>This result is empty.</Notice>;
  const hidden = new Set(["generated_at", "source_url", "sources"]);
  const entries = orderedEntries(content, kind).filter(([k, v]) => !hidden.has(k) && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
  if (!entries.length) return <Notice>This result is empty.</Notice>;
  return (
    <div className={styles.doc}>
      {entries.map(([key, value]) => (
        <Section key={key} title={humanizeKey(key)} count={Array.isArray(value) ? value.length : undefined}>
          <GenericValue value={value} />
        </Section>
      ))}
    </div>
  );
}

function GenericValue({ value }: { value: unknown }) {
  if (typeof value === "string") return value.length > 280 || value.includes("\n") ? <Markdown compact>{value}</Markdown> : <Prose>{value}</Prose>;
  if (typeof value === "number" || typeof value === "boolean") return <Prose>{String(value)}</Prose>;
  if (Array.isArray(value)) {
    if (value.every((v) => !isDict(v))) return <Bullets items={value.map((v) => text(v) || JSON.stringify(v))} />;
    return (
      <div className={styles.cards}>
        {value.map((item, i) =>
          isDict(item) ? (
            <Card key={i} title={text(item.name) || text(item.title) || `Item ${i + 1}`}>
              <KeyValues
                rows={Object.entries(item)
                  .filter(([k]) => k !== "name" && k !== "title")
                  .map(([k, v]) => [humanizeKey(k), Array.isArray(v) ? strings(v).join(", ") : isDict(v) ? JSON.stringify(v) : text(v)])}
              />
            </Card>
          ) : (
            <Card key={i} title={text(item)} />
          ),
        )}
      </div>
    );
  }
  if (isDict(value)) {
    return <KeyValues rows={Object.entries(value).map(([k, v]) => [humanizeKey(k), Array.isArray(v) ? strings(v).join(", ") : isDict(v) ? JSON.stringify(v) : text(v)])} />;
  }
  return null;
}
