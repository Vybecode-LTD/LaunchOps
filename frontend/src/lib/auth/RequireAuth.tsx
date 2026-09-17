import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Display";
import { Wordmark } from "@/components/shell/Wordmark";
import { useAuth } from "./AuthProvider";
import styles from "./RequireAuth.module.css";

export function RequireAuth() {
  const { state, retry } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return (
      <div className={styles.splash}>
        <Wordmark />
        <Spinner label="Loading your workspace" />
      </div>
    );
  }

  if (state.status === "offline") {
    return (
      <div className={styles.splash}>
        <Wordmark />
        <p className={styles.message}>{state.message}</p>
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status === "anonymous") {
    const next = `${location.pathname}${location.search}`;
    const search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/login${search}`} replace state={{ notice: state.notice }} />;
  }

  return <Outlet />;
}
