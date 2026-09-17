import { Link } from "react-router";
import { Compass } from "lucide-react";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { EmptyState, Panel } from "@/components/ui/Display";

export function NotFoundPage() {
  return (
    <Panel>
      <EmptyState
        icon={<Compass aria-hidden="true" />}
        title="Page not found"
        centered
        action={
          <Button asChild variant="primary">
            <Link to={routes.portfolio}>Go to portfolio</Link>
          </Button>
        }
      >
        The address may be mistyped, or the page has moved.
      </EmptyState>
    </Panel>
  );
}
