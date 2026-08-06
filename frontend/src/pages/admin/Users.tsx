import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { Badge, Modal, PageHead } from "../../components/ui";
import type { Employer, Institution, Role, User } from "../../types";

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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    email: "",
    full_name: "",
    phone: "",
    password: "",
    role: "recruiter",
    institution_id: "",
    employer_id: "",
    recruiter_details: {
      agency_name: "",
      tier: "junior",
      experience_years: "",
      specialization: "",
      linkedin_url: "",
      target_placements_month: "",
      max_job_load: "",
      commission_rate: "",
    }
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

  useEffect(() => {
    api.get<Institution[]>("/institutions").then((r) => setInstitutions(r.data)).catch(() => {});
    api.get<Employer[]>("/employers").then((r) => setEmployers(r.data)).catch(() => {});
  }, []);

  function handleNewUser() {
    setEditingUser(null);
    setErr("");
    setForm({
      email: "",
      full_name: "",
      phone: "",
      password: "",
      role: roleFilter && ROLES.includes(roleFilter as Role) ? roleFilter : "recruiter",
      institution_id: "",
      employer_id: "",
      recruiter_details: {
        agency_name: "",
        tier: "junior",
        experience_years: "",
        specialization: "",
        linkedin_url: "",
        target_placements_month: "",
        max_job_load: "",
        commission_rate: "",
      }
    });
    setOpen(true);
  }

  function handleEditUser(u: User) {
    setEditingUser(u);
    setErr("");
    const details = u.recruiter_details || {};
    setForm({
      email: u.email,
      full_name: u.full_name,
      phone: u.phone || "",
      password: "",
      role: u.role,
      institution_id: u.institution_id || "",
      employer_id: u.employer_id || "",
      recruiter_details: {
        agency_name: details.agency_name || "",
        tier: details.tier || "junior",
        experience_years: details.experience_years ?? "",
        specialization: details.specialization || "",
        linkedin_url: details.linkedin_url || "",
        target_placements_month: details.target_placements_month ?? "",
        max_job_load: details.max_job_load ?? "",
        commission_rate: details.commission_rate ?? "",
      }
    });
    setOpen(true);
  }

  async function save() {
    setErr("");
    if (!form.full_name?.trim()) {
      setErr("Full Name is required.");
      return;
    }
    if (!editingUser && (!form.email?.trim() || !form.password?.trim())) {
      setErr("Email and Temporary Password are required for new users.");
      return;
    }

    setBusy(true);
    try {
      let recruiter_details = null;
      if (form.role === "recruiter") {
        const details = form.recruiter_details || {};
        recruiter_details = {
          agency_name: details.agency_name?.trim() || null,
          tier: details.tier || "junior",
          experience_years: details.experience_years !== "" && details.experience_years !== null ? Number(details.experience_years) : null,
          specialization: details.specialization?.trim() || null,
          linkedin_url: details.linkedin_url?.trim() || null,
          target_placements_month: details.target_placements_month !== "" && details.target_placements_month !== null ? Number(details.target_placements_month) : null,
          max_job_load: details.max_job_load !== "" && details.max_job_load !== null ? Number(details.max_job_load) : null,
          commission_rate: details.commission_rate !== "" && details.commission_rate !== null ? Number(details.commission_rate) : null,
        };
      }

      if (editingUser) {
        const patchPayload: Record<string, any> = {
          full_name: form.full_name,
          phone: form.phone || null,
          role: form.role,
        };
        if (form.role === "recruiter") {
          patchPayload.recruiter_details = recruiter_details;
        }
        await api.patch(`/users/${editingUser.id}`, patchPayload);
      } else {
        const payload: Record<string, any> = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone?.trim() || null,
        };
        if (form.role === "institution" && form.institution_id) {
          payload.institution_id = Number(form.institution_id);
        }
        if (form.role === "employer" && form.employer_id) {
          payload.employer_id = Number(form.employer_id);
        }
        if (form.role === "recruiter") {
          payload.recruiter_details = recruiter_details;
        }
        await api.post("/users", payload);
      }
      setOpen(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? (editingUser ? "Could not update user" : "Could not create user"));
    } finally {
      setBusy(false);
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
          <button className="btn primary" onClick={handleNewUser}>
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
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <button className="btn link" style={{ padding: 0, textAlign: "left", fontWeight: 600 }} onClick={() => handleEditUser(u)}>
                    {u.full_name}
                  </button>
                  {u.role === "recruiter" && u.recruiter_details && Object.keys(u.recruiter_details).length > 0 && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {[
                        u.recruiter_details.tier && `${u.recruiter_details.tier.charAt(0).toUpperCase() + u.recruiter_details.tier.slice(1)} Recruiter`,
                        u.recruiter_details.specialization && `Focus: ${u.recruiter_details.specialization}`,
                        u.recruiter_details.experience_years && `${u.recruiter_details.experience_years}y Exp`,
                        u.recruiter_details.agency_name && `@ ${u.recruiter_details.agency_name}`,
                      ].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </div>
              </td>
              <td>{u.email}</td>
              <td>{u.phone || "—"}</td>
              <td>
                <Badge value={u.role} />
              </td>
              <td>{u.is_active ? "Active" : "Disabled"}</td>
              <td>
                <div className="btn-row">
                  <button className="btn link" onClick={() => handleEditUser(u)}>
                    Edit
                  </button>
                  <button className="btn link" onClick={() => toggle(u)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {open && (
        <Modal title={editingUser ? `Edit User — ${editingUser.full_name}` : "New User"} onClose={() => setOpen(false)}>
          {err && <div className="error-note">{err}</div>}
          <div className="form-grid one-col" style={{ border: "none", padding: 0 }}>
            <div className="field">
              <label>Full Name<span className="req">*</span></label>
              <input
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Full Name"
              />
            </div>
            <div className="field">
              <label>Email Address{!editingUser && <span className="req">*</span>}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={!!editingUser}
                placeholder="user@smarthire.in"
              />
            </div>
            <div className="field">
              <label>Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="10-digit mobile number"
              />
            </div>
            {!editingUser && (
              <div className="field">
                <label>Temporary Password<span className="req">*</span></label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Set initial password"
                />
              </div>
            )}
            <div className="field">
              <label>Role<span className="req">*</span></label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            {!editingUser && form.role === "institution" && (
              <div className="field">
                <label>Assigned Institution</label>
                <select
                  value={form.institution_id}
                  onChange={(e) => set("institution_id", e.target.value)}
                >
                  <option value="">Select Institution…</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!editingUser && form.role === "employer" && (
              <div className="field">
                <label>Assigned Employer / Client</label>
                <select
                  value={form.employer_id}
                  onChange={(e) => set("employer_id", e.target.value)}
                >
                  <option value="">Select Employer…</option>
                  {employers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {form.role === "recruiter" && (
            <div style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 8,
              backgroundColor: "rgba(240, 244, 248, 0.5)",
              border: "1px solid #d2dbe5",
              width: "100%"
            }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#1a2e40" }}>
                Recruiter Profile Details
              </h4>
              <div className="form-grid" style={{ border: "none", padding: 0, background: "none" }}>
                <div className="field">
                  <label>Agency / Department</label>
                  <input
                    value={form.recruiter_details?.agency_name || ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, agency_name: e.target.value })}
                    placeholder="e.g. Internal, Apex Staffing"
                  />
                </div>
                <div className="field">
                  <label>Recruiter Tier / Level</label>
                  <select
                    value={form.recruiter_details?.tier || "junior"}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, tier: e.target.value })}
                  >
                    <option value="junior">Junior Recruiter</option>
                    <option value="senior">Senior Recruiter</option>
                    <option value="lead">Recruitment Lead</option>
                    <option value="principal">Principal Recruiter</option>
                  </select>
                </div>
                <div className="field">
                  <label>Years of Experience</label>
                  <input
                    type="number"
                    value={form.recruiter_details?.experience_years ?? ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, experience_years: e.target.value })}
                    placeholder="Years"
                    min="0"
                  />
                </div>
                <div className="field">
                  <label>Specialization Focus</label>
                  <input
                    value={form.recruiter_details?.specialization || ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, specialization: e.target.value })}
                    placeholder="e.g. Tech, BPO, Healthcare"
                  />
                </div>
                <div className="field">
                  <label>Target Placements / Month</label>
                  <input
                    type="number"
                    value={form.recruiter_details?.target_placements_month ?? ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, target_placements_month: e.target.value })}
                    placeholder="Target quota"
                    min="0"
                  />
                </div>
                <div className="field">
                  <label>Max Concurrent Job Load</label>
                  <input
                    type="number"
                    value={form.recruiter_details?.max_job_load ?? ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, max_job_load: e.target.value })}
                    placeholder="Max active jobs"
                    min="0"
                  />
                </div>
                <div className="field">
                  <label>Commission / Placement Fee Rate (%)</label>
                  <input
                    type="number"
                    value={form.recruiter_details?.commission_rate ?? ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, commission_rate: e.target.value })}
                    placeholder="Fee rate percentage"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="field">
                  <label>LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={form.recruiter_details?.linkedin_url || ""}
                    onChange={(e) => set("recruiter_details", { ...form.recruiter_details, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? "Saving..." : editingUser ? "Update User" : "Create User"}
            </button>
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
