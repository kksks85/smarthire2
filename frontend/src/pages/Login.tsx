import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface LoginTile {
  role: string;
  label: string;
  name: string;
  email: string;
  password: string;
  initials: string;
}

const TILES: LoginTile[] = [
  {
    role: "admin",
    label: "Administrator",
    name: "System Administrator",
    email: "admin@smarthire.io",
    password: "Admin@12345",
    initials: "SA",
  },
  {
    role: "manager",
    label: "Recruiting Manager",
    name: "Priya Sharma",
    email: "manager@smarthire.io",
    password: "Demo@12345",
    initials: "PS",
  },
  {
    role: "recruiter",
    label: "Recruiter",
    name: "Amit Verma",
    email: "recruiter@smarthire.io",
    password: "Demo@12345",
    initials: "AV",
  },
  {
    role: "field_agent",
    label: "Field Agent",
    name: "Ravi Patil",
    email: "agent@smarthire.io",
    password: "Demo@12345",
    initials: "RP",
  },
  {
    role: "institution",
    label: "Institution",
    name: "Skill India ITI",
    email: "institution@smarthire.io",
    password: "Demo@12345",
    initials: "SI",
  },
  {
    role: "employer",
    label: "Employer (Client)",
    name: "Tata Logistics HR",
    email: "employer@smarthire.io",
    password: "Demo@12345",
    initials: "TL",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [email, setEmail] = useState("admin@smarthire.io");
  const [password, setPassword] = useState("");

  async function loginAs(tile: LoginTile) {
    setError("");
    setBusy(tile.role);
    try {
      await login(tile.email, tile.password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Login failed");
      setBusy(null);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("manual");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Login failed");
      setBusy(null);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card wide">
        <img src="/logo.png" alt="SmartHire" className="login-logo" />
        {error && <div className="error-note">{error}</div>}

        <div className="login-hint">Select a role to sign in</div>
        <div className="tile-grid">
          {TILES.map((t) => (
            <button
              key={t.role}
              className="login-tile"
              onClick={() => loginAs(t)}
              disabled={busy !== null}
            >
              <span className={`tile-avatar role-${t.role}`}>{t.initials}</span>
              <span className="tile-role">{t.label}</span>
              <span className="tile-name">{t.name}</span>
              <span className="tile-cta">
                {busy === t.role ? "Signing in…" : "Click to login"}
              </span>
            </button>
          ))}
        </div>

        <div className="login-divider">
          <button className="btn link" onClick={() => setManual((m) => !m)}>
            {manual ? "Hide manual sign-in" : "Sign in with email & password"}
          </button>
        </div>

        {manual && (
          <form onSubmit={submitManual} className="manual-login">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              className="btn primary"
              style={{ width: "100%" }}
              disabled={busy !== null}
            >
              {busy === "manual" ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
