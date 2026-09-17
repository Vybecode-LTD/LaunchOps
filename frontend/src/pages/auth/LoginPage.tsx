import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { OPERATIONS } from "@/lib/domain/operations";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Display";
import { Wordmark } from "@/components/shell/Wordmark";
import styles from "./LoginPage.module.css";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/portfolio";
}

export function LoginPage({ mode }: { mode: "login" | "register" }) {
  const { state, login, register } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const notice = (location.state as { notice?: string } | null)?.notice;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "authenticated") return <Navigate to={next} replace />;

  const isRegister = mode === "register";
  const switchSearch = params.get("next") ? `?next=${encodeURIComponent(next)}` : "";

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && isRegister) {
        setError("Registration is closed. Ask an administrator to create an account for you.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.formColumn}>
        <Wordmark />
        <div className={styles.formWrap}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{isRegister ? "Create your account" : "Sign in"}</h1>
            <p className={styles.subtitle}>
              {isRegister ? "Set up a workspace for your launches." : "Welcome back to your launch board."}
            </p>
          </div>

          {notice && <Notice tone="warn">{notice}</Notice>}

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {isRegister && (
              <Field label="Name">
                {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
              </Field>
            )}
            <Field label="Email">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
              )}
            </Field>
            <Field label="Password" hint={isRegister ? "At least 8 characters." : undefined}>
              {(props) => (
                <div className={styles.passwordWrap}>
                  <Input
                    {...props}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    minLength={isRegister ? 8 : undefined}
                    required
                  />
                  <IconButton
                    size="sm"
                    className={styles.passwordToggle}
                    label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </IconButton>
                </div>
              )}
            </Field>
            {error && (
              <div role="alert">
                <Notice tone="crit">{error}</Notice>
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" loading={busy} full>
              {isRegister ? "Create account" : "Sign in"}
            </Button>
            {!isRegister && (
              <p className={styles.switch} style={{ margin: 0 }}>
                <Link to="/forgot-password">Forgot your password?</Link>
              </p>
            )}
          </form>

          <p className={styles.switch}>
            {isRegister ? (
              <>
                Already have an account? <Link to={`/login${switchSearch}`}>Sign in</Link>
              </>
            ) : (
              <>
                New to LaunchOps? <Link to={`/register${switchSearch}`}>Create an account</Link>
              </>
            )}
          </p>
        </div>
        <p className={styles.footer}>launchops.run</p>
      </div>

      <aside className={styles.panel} aria-label="About LaunchOps">
        <div className={styles.panelEyebrow}>Launch operations</div>
        <div className={styles.statement}>
          <h2 className={styles.statementTitle}>Every launch in your portfolio, on one board.</h2>
          <ul className={styles.facts}>
            <li className={styles.fact}>
              <span className={styles.factKey}>{String(OPERATIONS.length).padStart(2, "0")} ops</span>
              <span>Research, press, content, outreach and SEO operations for each project.</span>
            </li>
            <li className={styles.fact}>
              <span className={styles.factKey}>Review</span>
              <span>Every AI result waits for your approval. Emails are drafts until you press Send.</span>
            </li>
            <li className={styles.fact}>
              <span className={styles.factKey}>T–minus</span>
              <span>Launch dates, readiness and open work across every project at a glance.</span>
            </li>
          </ul>
        </div>
        <Trajectory />
      </aside>
    </div>
  );
}

/** Ascent arc over a countdown scale. Decorative. */
function Trajectory() {
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <svg className={styles.trajectory} viewBox="0 0 640 260" aria-hidden="true" fill="none">
      <path d="M24 236 C 220 228, 420 170, 560 44" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.85" />
      <path d="M24 236 C 220 228, 420 170, 560 44" strokeWidth="14" strokeLinecap="round" strokeOpacity="0.06" />
      <circle cx="560" cy="44" r="7" className={styles.apogee} />
      <line x1="16" y1="246" x2="624" y2="246" strokeWidth="1" strokeOpacity="0.3" />
      {ticks.map((i) => {
        const x = 24 + i * 58;
        return <line key={i} x1={x} y1="240" x2={x} y2={i % 5 === 0 ? 254 : 248} strokeWidth="1" strokeOpacity="0.4" />;
      })}
    </svg>
  );
}
