import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Notice, Skeleton } from "@/components/ui/Display";
import { Field, Input } from "@/components/ui/Field";
import { Wordmark } from "@/components/shell/Wordmark";
import styles from "./LoginPage.module.css";

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.page} ${styles.single}`}>
      <div className={styles.formColumn}>
        <Wordmark />
        <div className={styles.formWrap}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {children}
        </div>
        <p className={styles.footer}>launchops.run</p>
      </div>
    </div>
  );
}

/** /forgot-password — ask for a reset link by email. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p className={styles.subtitle}>
          If {sentTo} has a LaunchOps account, we&apos;ve sent it a link to choose a new password. The link expires in 1 hour.
        </p>
        <Notice tone="info">No email after a few minutes? Check your spam folder, or ask your LaunchOps administrator for a reset link.</Notice>
        <p className={styles.switch}>
          <Link to={routes.login}>Back to sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="Enter the email address you sign in with, and we'll email you a link to choose a new password.">
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await authApi.requestPasswordReset(email.trim());
            setSentTo(email.trim());
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Email">
          {(props) => <Input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />}
        </Field>
        {error && (
          <div role="alert">
            <Notice tone="crit">{error}</Notice>
          </div>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy} full>
          Email me a reset link
        </Button>
      </form>
      <p className={styles.switch}>
        Remembered it? <Link to={routes.login}>Sign in</Link>
      </p>
    </AuthCard>
  );
}

/** /reset-password/:token — choose a new password from a reset link, then carry on signed in. */
export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const reset = useQuery({ queryKey: ["password-reset", token], queryFn: () => authApi.describePasswordReset(token), retry: false });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reset.isLoading) {
    return (
      <AuthCard title="Choose a new password">
        <Skeleton height={120} />
      </AuthCard>
    );
  }
  if (reset.isError || !reset.data) {
    return (
      <AuthCard title="Reset link unavailable">
        <Notice tone="warn">{errorMessage(reset.error)}</Notice>
        <p className={styles.switch}>
          <Link to="/forgot-password">Get a new reset link</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle={`For ${reset.data.email}. You'll be signed out everywhere else.`}>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            signIn(await authApi.resetPassword(token, password));
            navigate(routes.portfolio, { replace: true });
          } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
          }
        }}
      >
        <Field label="New password" hint="At least 8 characters.">
          {(props) => (
            <Input
              {...props}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
          )}
        </Field>
        {error && (
          <div role="alert">
            <Notice tone="crit">{error}</Notice>
          </div>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy} full disabled={password.length < 8}>
          Save password and sign in
        </Button>
      </form>
    </AuthCard>
  );
}
