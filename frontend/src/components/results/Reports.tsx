import type { MarketAnalysis, PressKit, PressRelease, PricingResult, ReportKey, SeoResult } from "@/lib/api/types";
import { parseScenarios } from "@/lib/domain/chart";
import { SEO_TAG_ORDER, orderJsonLd, sortKeys, sortScenarioKeys } from "@/lib/domain/order";
import { SEO_TAG_LABELS, seoAssistantPrompt } from "@/lib/domain/reports";
import { dicts, humanizeKey, isDict, list, numberFrom, strings, text } from "@/lib/domain/values";
import { CopyButton, Notice } from "@/components/ui/Display";
import { Markdown } from "@/components/ui/Markdown";
import { Pill } from "@/components/ui/Pill";
import { Bullets, Card, Chips, ExternalLink, KeyValues, Prose, Section, Sources } from "./primitives";
import { RevenueChart } from "./RevenueChart";
import styles from "./Results.module.css";

/** A report's sections, ending with any sources its research relied on (market analysis, pricing and press releases have them). */
export function ReportBody({ reportKey, value, pageUrl }: { reportKey: ReportKey; value: unknown; pageUrl?: string }) {
  if (!isDict(value)) return null;
  // Only reports stored before results were validated can be unstructured.
  if (text(value.raw_response)) {
    return (
      <div className={styles.doc}>
        <Notice tone="warn">The model's reply couldn't be structured, so it is shown as text. Run the operation again to try for a structured report.</Notice>
        <Markdown>{text(value.raw_response)}</Markdown>
      </div>
    );
  }
  return (
    <div className={styles.doc}>
      <ReportSections reportKey={reportKey} value={value} pageUrl={pageUrl} />
      <Sources result={value} />
    </div>
  );
}

function ReportSections({ reportKey, value, pageUrl }: { reportKey: ReportKey; value: Record<string, unknown>; pageUrl?: string }) {
  switch (reportKey) {
    case "market_analysis":
      return <MarketAnalysisReport data={value as MarketAnalysis} />;
    case "pricing_result":
      return <PricingReport data={value as PricingResult} />;
    case "press_kit":
      return <PressKitReport data={value as PressKit} />;
    case "press_release":
      return <PressReleaseReport data={value as PressRelease} />;
    case "seo_result":
      return <SeoReport data={value as SeoResult} pageUrl={pageUrl} />;
  }
}

/* ─── Market analysis ─── */

const SEVERITY_TONE: Record<string, "crit" | "warn" | "neutral"> = { high: "crit", medium: "warn", low: "neutral" };

function MarketAnalysisReport({ data }: { data: MarketAnalysis }) {
  const players = dicts(data.key_players);
  const benchmarks = isDict(data.pricing_benchmarks) ? data.pricing_benchmarks : undefined;
  const differentiation = isDict(data.differentiation) ? data.differentiation : undefined;
  const barriers = dicts(data.barriers_to_entry);
  const revenue = isDict(data.revenue_projections) ? data.revenue_projections : undefined;
  const scenarios = revenue && isDict(revenue.scenarios) ? (revenue.scenarios as Record<string, Record<string, unknown>>) : undefined;
  const series = parseScenarios(scenarios);
  const segments = dicts(data.target_segments).sort((a, b) => (numberFrom(a.priority) ?? 99) - (numberFrom(b.priority) ?? 99));

  return (
    <div className={styles.doc}>
      {text(data.executive_summary) && (
        <Section id="summary" title="Executive summary" copy={text(data.executive_summary)}>
          <div className={styles.summaryBox}>
            <Markdown compact>{text(data.executive_summary)}</Markdown>
          </div>
        </Section>
      )}

      {players.length > 0 && (
        <Section id="players" title="Key players" count={players.length}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Company</th>
                  <th className="placard">What they do</th>
                  <th className="placard">Position</th>
                  <th className="placard">Users</th>
                  <th className="placard">Funding</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 600 }}>{text(p.name)}</div>
                      <ExternalLink href={p.url} />
                    </td>
                    <td style={{ minWidth: 240 }}>
                      {text(p.description)}
                      {text(p.differentiator) && <div style={{ color: "var(--ink-3)", marginTop: 4 }}>Edge: {text(p.differentiator)}</div>}
                    </td>
                    <td>{text(p.market_position)}</td>
                    <td>{text(p.estimated_users)}</td>
                    <td>{text(p.funding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {benchmarks && (
        <Section id="pricing" title="Pricing benchmarks">
          <KeyValues
            rows={[
              [
                "Market range",
                text(benchmarks.market_range_low) || text(benchmarks.market_range_high)
                  ? `${text(benchmarks.market_range_low) || "?"} – ${text(benchmarks.market_range_high) || "?"}`
                  : "",
              ],
              ["Common models", strings(benchmarks.common_models).join(", ")],
            ]}
          />
          {text(benchmarks.positioning_recommendation) && <div className={styles.summaryBox}>{text(benchmarks.positioning_recommendation)}</div>}
          {dicts(benchmarks.benchmark_table).length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className="placard">Competitor</th>
                    <th className="placard">Plan</th>
                    <th className="placard num">Price</th>
                    <th className="placard">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {dicts(benchmarks.benchmark_table).map((row, i) => (
                    <tr key={i}>
                      <td>{text(row.competitor)}</td>
                      <td>{text(row.plan)}</td>
                      <td className="num">{text(row.price)}</td>
                      <td>{text(row.model)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {differentiation && (
        <Section id="differentiation" title="Competitive differentiation">
          {text(differentiation.summary) && <Prose>{text(differentiation.summary)}</Prose>}
          <div className={styles.cards}>
            {dicts(differentiation.unique_advantages).map((a, i) => (
              <Card key={i} title={text(a.advantage)}>
                <KeyValues
                  rows={[
                    ["Why it matters", text(a.why_it_matters)],
                    ["Competitor gap", text(a.competitor_gap)],
                  ]}
                />
              </Card>
            ))}
          </div>
          {text(differentiation.positioning_statement) && (
            <div className={styles.summaryBox}>
              <div className="placard" style={{ marginBottom: 6 }}>
                Positioning statement
              </div>
              {text(differentiation.positioning_statement)}
            </div>
          )}
        </Section>
      )}

      {barriers.length > 0 && (
        <Section id="barriers" title="Barriers to entry" count={barriers.length}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Barrier</th>
                  <th className="placard">Severity</th>
                  <th className="placard">Description</th>
                  <th className="placard">Implication</th>
                </tr>
              </thead>
              <tbody>
                {barriers.map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, minWidth: 140 }}>{text(b.barrier)}</td>
                    <td>
                      <Pill tone={SEVERITY_TONE[text(b.severity).toLowerCase()] ?? "neutral"}>{humanizeKey(text(b.severity)) || "Unrated"}</Pill>
                    </td>
                    <td>{text(b.description)}</td>
                    <td>{text(b.implication)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {revenue && (
        <Section id="revenue" title="Revenue projections">
          {text(revenue.pricing_used) && <KeyValues rows={[["Pricing used", text(revenue.pricing_used)]]} />}
          <Notice>These are model-generated scenarios based on the pricing above and web research, not forecasts. Check the assumptions before quoting them.</Notice>
          {series && <RevenueChart series={series} />}
          {scenarios && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className="placard">Scenario</th>
                    <th className="placard num">Year 1</th>
                    <th className="placard num">Year 2</th>
                    <th className="placard num">Year 3</th>
                    <th className="placard">Assumptions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortScenarioKeys(Object.keys(scenarios)).map((name) => [name, scenarios[name]!] as const).map(([name, s]) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{name}</td>
                      <td className="num">{text(s.y1)}</td>
                      <td className="num">{text(s.y2)}</td>
                      <td className="num">{text(s.y3)}</td>
                      <td style={{ minWidth: 260 }}>{text(s.assumptions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {segments.length > 0 && (
        <Section id="segments" title="Target customer segments" count={segments.length}>
          <div className={styles.cards}>
            {segments.map((s, i) => (
              <Card
                key={i}
                title={text(s.name)}
                aside={text(s.priority) ? <Pill tone="outline" dot={false}>Priority {text(s.priority)}</Pill> : undefined}
              >
                {text(s.description) && <p className={styles.cardText}>{text(s.description)}</p>}
                <KeyValues
                  rows={[
                    ["Size", text(s.segment_size)],
                    ["Willingness to pay", text(s.willingness_to_pay)],
                    ["Channel", text(s.acquisition_channel)],
                  ]}
                />
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ─── Pricing ─── */

function PricingReport({ data }: { data: PricingResult }) {
  const tiers = dicts(data.tiers);
  const competitors = dicts(data.competitor_prices);
  return (
    <div className={styles.doc}>
      {tiers.length > 0 && (
        <Section id="tiers" title="Recommended tiers" count={tiers.length}>
          <div className={styles.cards}>
            {tiers.map((t, i) => (
              <Card
                key={i}
                className={`${styles.tier} ${t.recommended === true ? styles.tierRecommended : ""}`}
                title={text(t.name) || `Tier ${i + 1}`}
                aside={t.recommended === true ? <Pill tone="signal">Recommended</Pill> : undefined}
              >
                <div className={styles.tierPrice}>{text(t.price) || "—"}</div>
                <Bullets items={strings(t.features)} />
              </Card>
            ))}
          </div>
        </Section>
      )}
      {text(data.launch_strategy) && (
        <Section id="strategy" title="Launch strategy" copy={text(data.launch_strategy)}>
          <Prose>{text(data.launch_strategy)}</Prose>
        </Section>
      )}
      {competitors.length > 0 && (
        <Section id="competitors" title="Competitor prices" count={competitors.length}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Competitor</th>
                  <th className="placard num">Price</th>
                  <th className="placard">Model</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{text(c.name)}</td>
                    <td className="num">{text(c.price)}</td>
                    <td>{text(c.model)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {strings(data.insights).length > 0 && (
        <Section id="insights" title="Market insights">
          <Bullets items={strings(data.insights)} />
        </Section>
      )}
    </div>
  );
}

/* ─── Press kit ─── */

function PressKitReport({ data }: { data: PressKit }) {
  const features = strings(data.key_features ?? data.features);
  const assets = strings(data.media_assets ?? data.assets);
  return (
    <div className={styles.doc}>
      {text(data.boilerplate) && (
        <Section id="boilerplate" title="Boilerplate" copy={text(data.boilerplate)}>
          <Prose>{text(data.boilerplate)}</Prose>
        </Section>
      )}
      {features.length > 0 && (
        <Section id="features" title="Key features" count={features.length} copy={features.map((f) => `• ${f}`).join("\n")}>
          <Bullets items={features} />
        </Section>
      )}
      {text(data.target_audience) && (
        <Section id="audience" title="Target audience" copy={text(data.target_audience)}>
          <Prose>{text(data.target_audience)}</Prose>
        </Section>
      )}
      {text(data.founder_bio) && (
        <Section id="founder" title="Founder bio" copy={text(data.founder_bio)}>
          <Prose>{text(data.founder_bio)}</Prose>
        </Section>
      )}
      {strings(data.suggested_angles).length > 0 && (
        <Section id="angles" title="Story angles" count={strings(data.suggested_angles).length}>
          <Bullets items={strings(data.suggested_angles)} />
        </Section>
      )}
      {assets.length > 0 && (
        <Section id="assets" title="Media assets to prepare" count={assets.length}>
          <Bullets items={assets} />
        </Section>
      )}
    </div>
  );
}

/* ─── Press release ─── */

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  wire_service: "Wire service",
  industry_publication: "Industry publication",
  tech_blog: "Tech blog",
  journalist: "Journalist",
  directory: "Directory",
  podcast: "Podcast",
};

function PressReleaseReport({ data }: { data: PressRelease }) {
  const channels = list(data.suggested_distribution);
  const release = [text(data.headline) && `# ${text(data.headline)}`, text(data.subheadline) && `_${text(data.subheadline)}_`, text(data.body)]
    .filter(Boolean)
    .join("\n\n");
  return (
    <div className={styles.doc}>
      {(text(data.headline) || text(data.body)) && (
        <Section id="release" title="Release" copy={release}>
          {text(data.headline) && <h3 className={styles.headline}>{text(data.headline)}</h3>}
          {text(data.subheadline) && <p className={styles.subheadline}>{text(data.subheadline)}</p>}
          {text(data.body) && <Markdown>{text(data.body)}</Markdown>}
        </Section>
      )}
      {text(data.summary) && (
        <Section id="summary" title="Distribution summary" copy={text(data.summary)}>
          <div className={styles.summaryBox}>{text(data.summary)}</div>
        </Section>
      )}
      {channels.length > 0 && (
        <Section id="distribution" title="Distribution channels" count={channels.length}>
          <Notice>Outlets and contact details come from web research at the time of the run. Confirm each one before you pitch.</Notice>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Outlet</th>
                  <th className="placard">Type</th>
                  <th className="placard">How to reach</th>
                  <th className="placard">Why</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((raw, i) => {
                  if (!isDict(raw)) {
                    return (
                      <tr key={i}>
                        <td colSpan={4}>{text(raw)}</td>
                      </tr>
                    );
                  }
                  const email = text(raw.contact_email);
                  return (
                    <tr key={i}>
                      <td style={{ minWidth: 160 }}>
                        <div style={{ fontWeight: 600 }}>{text(raw.name) || "Outlet"}</div>
                        <ExternalLink href={raw.url} />
                      </td>
                      <td>{text(raw.type) ? <Pill tone="outline" dot={false}>{CHANNEL_TYPE_LABEL[text(raw.type)] ?? text(raw.type)}</Pill> : null}</td>
                      <td style={{ minWidth: 180 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {text(raw.submission_url) && <ExternalLink href={raw.submission_url}>Submission page</ExternalLink>}
                          {email && (
                            <a className={styles.link} href={`mailto:${email}`}>
                              {email}
                            </a>
                          )}
                          {!email && !text(raw.submission_url) && <span className={styles.muted}>No contact found</span>}
                        </div>
                      </td>
                      <td>{text(raw.notes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {strings(data.seo_keywords).length > 0 && (
        <Section id="keywords" title="SEO keywords" copy={strings(data.seo_keywords).join(", ")}>
          <Chips items={strings(data.seo_keywords)} />
        </Section>
      )}
    </div>
  );
}

/* ─── SEO ─── */

function SeoReport({ data, pageUrl }: { data: SeoResult; pageUrl?: string }) {
  const optimized = isDict(data.optimized) ? data.optimized : {};
  const current = numberFrom(data.current_score);
  const next = numberFrom(data.optimized_score);
  const tagRows = sortKeys(Object.keys(optimized), SEO_TAG_ORDER).map((k) => [k, optimized[k]] as const).filter(([k, v]) => k !== "json_ld" && k !== "score" && (text(v) || isDict(v)));
  const jsonLd = orderJsonLd(optimized.json_ld);
  return (
    <div className={styles.doc}>
      {(current !== null || next !== null) && (
        <Section id="scores" title="Scores">
          <div className={styles.scoreRow}>
            <div className={styles.score}>
              <span className="placard">Current</span>
              <span className={styles.scoreValue}>{current ?? "—"}</span>
            </div>
            <span className={styles.scoreArrow} aria-hidden="true">
              →
            </span>
            <div className={styles.score}>
              <span className="placard">After changes</span>
              <span className={styles.scoreValue}>{next ?? "—"}</span>
            </div>
          </div>
          <p className={styles.muted} style={{ fontSize: "var(--text-13)", maxWidth: "70ch" }}>
            Scores are the model's 0–100 assessment of the page's metadata, not a measurement from a search engine.
          </p>
        </Section>
      )}
      {strings(data.issues).length > 0 && (
        <Section id="issues" title="Issues found" count={strings(data.issues).length}>
          <Bullets items={strings(data.issues)} />
        </Section>
      )}
      {tagRows.length > 0 && (
        <Section id="tags" title="Optimized tags" count={tagRows.length}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="placard">Tag</th>
                  <th className="placard">Value</th>
                  <th className="placard" aria-label="Copy" />
                </tr>
              </thead>
              <tbody>
                {tagRows.map(([key, value]) => {
                  const v = isDict(value) ? JSON.stringify(value) : text(value);
                  return (
                    <tr key={key}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 560 }}>{SEO_TAG_LABELS[key] ?? key}</td>
                      <td className="mono" style={{ fontSize: "var(--text-12)", overflowWrap: "anywhere" }}>
                        {v}
                        {key === "title" && <div className={styles.muted}>{v.length} characters</div>}
                        {key === "description" && <div className={styles.muted}>{v.length} characters</div>}
                      </td>
                      <td data-print="hide">
                        <CopyButton value={v} label={`Copy ${SEO_TAG_LABELS[key] ?? key}`} iconOnly />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {jsonLd ? (
            <div>
              <div className="placard" style={{ margin: "8px 0" }}>
                JSON-LD
              </div>
              <pre className={styles.code}>{typeof jsonLd === "string" ? jsonLd : JSON.stringify(jsonLd, null, 2)}</pre>
            </div>
          ) : null}
        </Section>
      )}
      {text(data.head_block) && (
        <Section
          id="head"
          title="Head block"
          copy={text(data.head_block)}
          actions={<CopyButton value={() => seoAssistantPrompt(data, pageUrl ?? "")} label="Copy prompt for coding assistant" />}
        >
          <pre className={styles.code}>{text(data.head_block)}</pre>
        </Section>
      )}
    </div>
  );
}
