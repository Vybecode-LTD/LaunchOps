import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { errorMessage } from "@/lib/api/client";
import { invitationsApi } from "@/lib/api/endpoints";
import type { InvitationDetails } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { roleWithArticle } from "@/lib/auth/organisation";
import { useInvitationDetails } from "@/lib/queries/hooks";
import { formatTimestamp } from "@/lib/domain/dates";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Notice, Skeleton } from "@/components/ui/Display";
import { Field, Input } from "@/components/ui/Field";
import { Wordmark } from "@/components/shell/Wordmark";
import styles from "./LoginPage.module.css";

/** /invite/:token — join an organisation from an invitation link, signing in or creating an account on the way. */
export function InvitePage() {
  const { token = "" } = useParams();
  const invitation = useInvitationDetails(token);

  return (
    <div className={`${styles.page} ${styles.single}`}>
      <div className={styles.formColumn}>
        <Wordmark />
        <div className={styles.formWrap}>
          {invitation.isLoading ? (
            <Skeleton height={160} />
          ) : invitation.isError || !invitation.data ? (
            <>
              <div className={styles.heading}>
                <h1 className={styles.title}>Invitation unavailable</h1>
              </div>
              <Notice tone="warn">{errorMessage(invitation.error)}</Notice>
              <p className={styles.switch}>
                <Link to={routes.login}>Go to sign in</Link>
              </p>
            </>
          ) : (
            <Invitation token={token} invitation={invitation.data} />
          )}
        </div>
        <p className={styles.footer}>launchops.run</p>
      </div>
    </div>
  );
}

function Invitation({ token, invitation }: { token: string; invitation: InvitationDetails }) {
  const { state, user, logout } = useAuth();
  const invitedBy = invitation.invited_by ? `${invitation.invited_by} invited you` : "You're invited";
  const here = `/invite/${encodeURIComponent(token)}`;

  return (
    <>
      <div className={styles.heading}>
        <h1 className={styles.title}>Join {invitation.organisation}</h1>
        <p className={styles.subtitle}>
          {invitedBy} to join as {roleWithArticle(invitation.role)}. The invitation is for {invitation.email} and expires{" "}
          {formatTimestamp(invitation.expires_at)}.
        </p>
      </div>
      {state.status === "loading" ? (
        <Skeleton height={48} />
      ) : user ? (
        user.email.toLowerCase() === invitation.email ? (
          <Accept token={token} organisation={invitation.organisation} />
        ) : (
          <>
            <Notice tone="warn">
              You&apos;re signed in as {user.email}. Sign out, then sign in as {invitation.email} to accept.
            </Notice>
            <Button variant="secondary" size="lg" full onClick={logout}>
              Sign out
            </Button>
          </>
        )
      ) : invitation.account_exists ? (
        <>
          <Notice tone="info">{invitation.email} already has a LaunchOps account. Sign in with it to accept.</Notice>
          <Link to={`${routes.login}?next=${encodeURIComponent(here)}`} className={styles.primaryLink}>
            Sign in to accept
          </Link>
        </>
      ) : (
        <CreateAccount token={token} email={invitation.email} organisation={invitation.organisation} />
      )}
    </>
  );
}

function Accept({ token, organisation }: { token: string; organisation: string }) {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <div role="alert">
          <Notice tone="crit">{error}</Notice>
        </div>
      )}
      <Button
        variant="primary"
        size="lg"
        full
        loading={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const membership = await invitationsApi.accept(token);
            await refreshUser(membership.id);
            navigate(routes.portfolio, { replace: true });
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        Join {organisation}
      </Button>
    </>
  );
}

function CreateAccount({ token, email, organisation }: { token: string; email: string; organisation: string }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          const result = await invitationsApi.register(token, name.trim(), password);
          signIn(result, result.user.organisations[0]?.id);
          navigate(routes.portfolio, { replace: true });
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <Field label="Email">{(props) => <Input {...props} value={email} readOnly />}</Field>
      <Field label="Name">
        {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        {(props) => (
          <Input
            {...props}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        )}
      </Field>
      {error && (
        <div role="alert">
          <Notice tone="crit">{error}</Notice>
        </div>
      )}
      <Button type="submit" variant="primary" size="lg" loading={busy} full disabled={password.length < 8}>
        Create account and join {organisation}
      </Button>
    </form>
  );
}
