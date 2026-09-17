import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { TriangleAlert } from "lucide-react";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";

/**
 * Shown when a page fails to render or load (for example after a deploy, when a
 * lazily loaded page file has changed). Inside the shell, navigation stays usable.
 */
export function RouteError() {
  const error = useRouteError();
  const chunkLoad = error instanceof TypeError && /dynamically imported module|Importing a module script failed/i.test(error.message);
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <Panel>
      <EmptyState
        icon={<TriangleAlert aria-hidden="true" />}
        title={chunkLoad ? "LaunchOps has been updated" : "This page couldn't be displayed"}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button asChild variant="secondary">
              <Link to={routes.portfolio}>Go to portfolio</Link>
            </Button>
          </div>
        }
      >
        {chunkLoad ? "Reload to get the latest version." : "Reload to try again. If it keeps happening, share the details below with your administrator."}
        {!chunkLoad && (
          <details style={{ marginTop: 12 }}>
            <summary>Details</summary>
            <code style={{ display: "block", marginTop: 6, whiteSpace: "pre-wrap" }}>{detail}</code>
          </details>
        )}
      </EmptyState>
    </Panel>
  );
}
