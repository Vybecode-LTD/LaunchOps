import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "./Button";
import styles from "./Display.module.css";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto" }}>
      <table>{children}</table>
    </div>
  ),
};

/**
 * Renders model-written Markdown. Raw HTML is not rendered and unsafe link
 * protocols are stripped. Kept in its own module so the Markdown engine loads
 * only with the pages that show AI text.
 */
export function Markdown({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div className={cx(styles.markdown, compact && styles.markdownCompact)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children.replace(/<\/?cite[^>]*>/g, "")}
      </ReactMarkdown>
    </div>
  );
}
