import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { Badge, Modal, PageHead } from "../../components/ui";
import type { Role, User } from "../../types";

const ROLES: Role[] = [
  "admin",
  "manager",
  "recruiter",
  "institution",
  "employer",
  "field_agent",
];

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>(searchParams.get("role") || "");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<Record<string, any>>({
    email: "",
    full_name: "",
    password: "",
    role: "recruiter",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const load = () =>
    api
      .get<User[]>("/users", {
        params: roleFilter ? { role: roleFilter } : {},
      })
      .then((r) => setUsers(r.data));

  useEffect(() => {
    setSearchParams(roleFilter ? { role: roleFilter } : {}, { replace: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  async function save() {
    setErr("");
    try {
      await api.post("/users", form);
      setOpen(false);
      setForm({ email: "", full_name: "", password: "", role: "recruiter" });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Could not create user");
    }
  }

  async function toggle(u: User) {
    await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  }

  return (
    <div>
      <PageHead
        title="Users & Roles"
        breadcrumb="Administration › Users & Roles"
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            + New User
          </button>
        }
      />
      <div className="list-toolbar">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <span className="muted">{users.length} user{users.length === 1 ? "" : "s"}</span>
      </div>
      <table className="sn-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>
                <Badge value={u.role} />
              </td>
              <td>{u.is_active ? "Active" : "Disabled"}</td>
              <td>
                <button className="btn link" onClick={() => toggle(u)}>
                  {u.is_active ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <Modal title="New User" onClose={() => setOpen(false)}>
          {err && <div className="error-note">{err}</div>}
          <div className="form-grid one-col" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Full Name</label>
              <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label>Temporary Password</label>
              <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={save}>
              Create
            </button>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
