import { useEffect, useState } from "react";
import api from "../api/client";
import { useReference } from "../hooks/useReference";
import { Modal, PageHead } from "../components/ui";
import type { Employer } from "../types";

interface Location {
  location_name: string;
  state: string;
  city: string;
  address: string;
  pincode: string;
}

interface Contact {
  contact_name: string;
  designation: string;
  department: string;
  mobile: string;
  email: string;
  preferred_method: string;
}

interface EmployerForm {
  company_name: string;
  industry: string;
  company_type: string;
  gst_number: string;
  website: string;
  locations: { items: Location[] };
  contacts: { items: Contact[] };
  required_candidate_fields: { fields: string[]; documents: string[] };
}

const INDUSTRIES = [
  "Manufacturing",
  "Logistics & Warehousing",
  "Construction",
  "Retail & E-commerce",
  "Food & Beverage",
  "Hospitality & Tourism",
  "Healthcare",
  "Automotive",
  "Textiles & Garments",
  "Electronics",
  "Pharmaceuticals",
  "Agriculture & Food Processing",
  "Mining & Metals",
  "Real Estate",
  "Others",
];

const COMPANY_TYPES = [
  "Private",
  "Public",
  "Government",
  "MNC",
  "Startup",
];

const CONTACT_METHODS = ["Phone", "Email", "WhatsApp"];

// Categorized checkboxes for required candidate information/documents
// The value must match the FormState field key in CandidateForm.tsx
const REQUIRED_FIELD_CATEGORIES: {
  category: string;
  fields: { key: string; label: string }[];
}[] = [
  {
    category: "Basic Information",
    fields: [
      { key: "full_name", label: "Full Name" },
      { key: "phone", label: "Mobile Number" },
      { key: "alt_phone", label: "Alternate Phone" },
      { key: "email", label: "Email Address" },
      { key: "gender", label: "Gender" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "marital_status", label: "Marital Status" },
      { key: "father_or_husband_name", label: "Father/Husband Name" },
    ],
  },
  {
    category: "Address",
    fields: [
      { key: "state", label: "State" },
      { key: "district", label: "District" },
      { key: "city", label: "City" },
      { key: "pincode", label: "PIN Code" },
      { key: "address", label: "Complete Address" },
    ],
  },
  {
    category: "KYC Details",
    fields: [
      { key: "aadhaar_number", label: "Aadhaar Number" },
      { key: "pan_number", label: "PAN Number" },
      { key: "driving_license_number", label: "Driving License Number" },
      { key: "passport_available", label: "Passport" },
    ],
  },
  {
    category: "Bank Details",
    fields: [
      { key: "bank_account_number", label: "Bank Account Number" },
      { key: "bank_ifsc_code", label: "IFSC Code" },
      { key: "bank_account_holder_name", label: "Account Holder Name" },
    ],
  },
  {
    category: "Education",
    fields: [
      { key: "highest_qualification", label: "Highest Qualification" },
      { key: "course_trade", label: "Course/Trade" },
      { key: "year_of_passing", label: "Year of Passing" },
    ],
  },
  {
    category: "Experience",
    fields: [
      { key: "total_experience", label: "Total Experience" },
      { key: "current_company", label: "Current Company" },
      { key: "current_role", label: "Current Role" },
      { key: "current_salary", label: "Current Salary" },
    ],
  },
  {
    category: "Other Details",
    fields: [
      { key: "skills", label: "Skills" },
      { key: "languages_known", label: "Languages Known" },
      { key: "emergency_name", label: "Emergency Contact Name" },
      { key: "emergency_phone", label: "Emergency Contact Phone" },
    ],
  },
];

const REQUIRED_DOCUMENT_OPTIONS: { key: string; label: string }[] = [
  { key: "photo_data_url", label: "Candidate Photo" },
  { key: "resume_file_name", label: "Resume/CV" },
  { key: "aadhaar_doc", label: "Aadhaar Card Copy" },
  { key: "pan_doc", label: "PAN Card Copy" },
  { key: "bank_statement_doc", label: "Bank Statement/Passbook" },
  { key: "education_certificates", label: "Education Certificates" },
  { key: "experience_letters", label: "Experience Letters" },
];

export default function Employers() {
  const ref = useReference();
  const [items, setItems] = useState<Employer[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "edit" | "view">("new");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployerForm>({
    company_name: "",
    industry: "",
    company_type: "",
    gst_number: "",
    website: "",
    locations: { items: [{ location_name: "", state: "", city: "", address: "", pincode: "" }] },
    contacts: { items: [{ contact_name: "", designation: "", department: "", mobile: "", email: "", preferred_method: "Phone" }] },
    required_candidate_fields: { fields: [], documents: [] },
  });

  const set = (k: keyof EmployerForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const addLocation = () => {
    setForm((f) => ({
      ...f,
      locations: {
        items: [...f.locations.items, { location_name: "", state: "", city: "", address: "", pincode: "" }],
      },
    }));
  };

  const removeLocation = (index: number) => {
    setForm((f) => ({
      ...f,
      locations: {
        items: f.locations.items.filter((_, i) => i !== index),
      },
    }));
  };

  const updateLocation = (index: number, field: keyof Location, value: string) => {
    setForm((f) => ({
      ...f,
      locations: {
        items: f.locations.items.map((loc, i) => (i === index ? { ...loc, [field]: value } : loc)),
      },
    }));
  };

  const addContact = () => {
    setForm((f) => ({
      ...f,
      contacts: {
        items: [...f.contacts.items, { contact_name: "", designation: "", department: "", mobile: "", email: "", preferred_method: "Phone" }],
      },
    }));
  };

  const removeContact = (index: number) => {
    setForm((f) => ({
      ...f,
      contacts: {
        items: f.contacts.items.filter((_, i) => i !== index),
      },
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    setForm((f) => ({
      ...f,
      contacts: {
        items: f.contacts.items.map((con, i) => (i === index ? { ...con, [field]: value } : con)),
      },
    }));
  };

  const toggleRequiredField = (fieldKey: string) => {
    setForm((f) => {
      const current = f.required_candidate_fields.fields;
      const updated = current.includes(fieldKey)
        ? current.filter((k) => k !== fieldKey)
        : [...current, fieldKey];
      return {
        ...f,
        required_candidate_fields: { ...f.required_candidate_fields, fields: updated },
      };
    });
  };

  const toggleRequiredDocument = (docKey: string) => {
    setForm((f) => {
      const current = f.required_candidate_fields.documents;
      const updated = current.includes(docKey)
        ? current.filter((k) => k !== docKey)
        : [...current, docKey];
      return {
        ...f,
        required_candidate_fields: { ...f.required_candidate_fields, documents: updated },
      };
    });
  };

  const load = () => api.get<Employer[]>("/employers").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      company_name: "",
      industry: "",
      company_type: "",
      gst_number: "",
      website: "",
      locations: { items: [{ location_name: "", state: "", city: "", address: "", pincode: "" }] },
      contacts: { items: [{ contact_name: "", designation: "", department: "", mobile: "", email: "", preferred_method: "Phone" }] },
      required_candidate_fields: { fields: [], documents: [] },
    });
    setEditingId(null);
    setMode("new");
  };

  const openNew = () => {
    resetForm();
    setMode("new");
    setOpen(true);
  };

  const openEdit = async (employer: Employer) => {
    setMode("edit");
    setEditingId(employer.id);
    
    // Populate form with employer data
    setForm({
      company_name: employer.company_name || "",
      industry: employer.industry || "",
      company_type: employer.company_type || "",
      gst_number: employer.gst_number || "",
      website: employer.website || "",
      locations: employer.locations?.items?.length > 0 
        ? employer.locations 
        : { items: [{ location_name: "", state: "", city: "", address: "", pincode: "" }] },
      contacts: employer.contacts?.items?.length > 0
        ? employer.contacts
        : { items: [{ contact_name: "", designation: "", department: "", mobile: "", email: "", preferred_method: "Phone" }] },
      required_candidate_fields: {
        fields: employer.required_candidate_fields?.fields ?? [],
        documents: employer.required_candidate_fields?.documents ?? [],
      },
    });
    setOpen(true);
  };

  const openView = async (employer: Employer) => {
    setMode("view");
    setEditingId(employer.id);
    
    // Populate form with employer data
    setForm({
      company_name: employer.company_name || "",
      industry: employer.industry || "",
      company_type: employer.company_type || "",
      gst_number: employer.gst_number || "",
      website: employer.website || "",
      locations: employer.locations?.items?.length > 0 
        ? employer.locations 
        : { items: [{ location_name: "", state: "", city: "", address: "", pincode: "" }] },
      contacts: employer.contacts?.items?.length > 0
        ? employer.contacts
        : { items: [{ contact_name: "", designation: "", department: "", mobile: "", email: "", preferred_method: "Phone" }] },
      required_candidate_fields: {
        fields: employer.required_candidate_fields?.fields ?? [],
        documents: employer.required_candidate_fields?.documents ?? [],
      },
    });
    setOpen(true);
  };

  async function save() {
    if (!form.company_name.trim()) {
      alert("Company name is required");
      return;
    }
    
    if (mode === "edit" && editingId) {
      await api.put(`/employers/${editingId}`, form);
    } else {
      await api.post("/employers", form);
    }
    
    setOpen(false);
    resetForm();
    load();
  }

  return (
    <div>
      <PageHead
        title="Employers (Clients)"
        breadcrumb="Partners › Employers"
        actions={
          <button className="btn primary" onClick={openNew}>
            + New Employer
          </button>
        }
      />
      <table className="sn-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Industry</th>
            <th>Contact</th>
            <th>City / State</th>
            <th>GST</th>
            <th style={{ width: "140px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.company_name}</td>
              <td>{e.industry ?? "—"}</td>
              <td>{e.contact_person ?? "—"}</td>
              <td>{[e.city, e.state].filter(Boolean).join(", ") || "—"}</td>
              <td>{e.gst_number ?? "—"}</td>
              <td>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="btn"
                    onClick={() => openView(e)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    👁️ View
                  </button>
                  <button
                    className="btn"
                    onClick={() => openEdit(e)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                No employers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {open && (
        <Modal 
          title={
            mode === "new" 
              ? "New Employer (Client) Registration" 
              : mode === "edit" 
              ? "Edit Employer (Client)" 
              : "View Employer (Client)"
          } 
          onClose={() => { setOpen(false); resetForm(); }}
        >
          <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "0 4px" }}>
            {/* Basic Information */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--accent)" }}>
                Basic Information
              </h3>
              <div className="form-grid" style={{ border: "none", padding: 0 }}>
                <div className="field full">
                  <label>Client Name<span className="req">*</span></label>
                  <input
                    value={form.company_name}
                    onChange={(e) => set("company_name", e.target.value)}
                    placeholder="Company name"
                    readOnly={mode === "view"}
                  />
                </div>
                <div className="field">
                  <label>Industry<span className="req">*</span></label>
                  <select value={form.industry} onChange={(e) => set("industry", e.target.value)} disabled={mode === "view"}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Company Type</label>
                  <select value={form.company_type} onChange={(e) => set("company_type", e.target.value)} disabled={mode === "view"}>
                    <option value="">Select type</option>
                    {COMPANY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>GST Number</label>
                  <input
                    value={form.gst_number}
                    onChange={(e) => set("gst_number", e.target.value.toUpperCase())}
                    placeholder="Optional"
                    maxLength={15}
                    readOnly={mode === "view"}
                  />
                </div>
                <div className="field">
                  <label>Website</label>
                  <input
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://example.com"
                    readOnly={mode === "view"}
                  />
                </div>
              </div>
            </div>

            {/* Office Locations */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--accent)" }}>
                  Office Locations
                </h3>
                {mode !== "view" && (
                  <button
                    type="button"
                    className="btn"
                    onClick={addLocation}
                    style={{ fontSize: "11px", padding: "4px 10px" }}
                  >
                    ➕ Add Location
                  </button>
                )}
              </div>
              {form.locations.items.map((location, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "12px",
                    marginBottom: "12px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Location {index + 1}</span>
                    {form.locations.items.length > 1 && mode !== "view" && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => removeLocation(index)}
                        style={{ fontSize: "11px", padding: "2px 8px", background: "var(--danger)", color: "#fff" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="form-grid" style={{ border: "none", padding: 0 }}>
                    <div className="field full">
                      <label>Location Name</label>
                      <input
                        value={location.location_name}
                        onChange={(e) => updateLocation(index, "location_name", e.target.value)}
                        placeholder="e.g., Head Office, Bangalore Branch"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>State<span className="req">*</span></label>
                      <select
                        value={location.state}
                        onChange={(e) => updateLocation(index, "state", e.target.value)}
                        disabled={mode === "view"}
                      >
                        <option value="">Select state</option>
                        {ref?.states.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>City<span className="req">*</span></label>
                      <input
                        value={location.city}
                        onChange={(e) => updateLocation(index, "city", e.target.value)}
                        placeholder="City name"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field full">
                      <label>Complete Address<span className="req">*</span></label>
                      <input
                        value={location.address}
                        onChange={(e) => updateLocation(index, "address", e.target.value)}
                        placeholder="Street, building, area"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>PIN Code</label>
                      <input
                        value={location.pincode}
                        onChange={(e) => updateLocation(index, "pincode", e.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        readOnly={mode === "view"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Point of Contact */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--accent)" }}>
                  Point of Contact (POC)
                </h3>
                {mode !== "view" && (
                  <button
                    type="button"
                    className="btn"
                    onClick={addContact}
                    style={{ fontSize: "11px", padding: "4px 10px" }}
                  >
                    ➕ Add Contact
                  </button>
                )}
              </div>
              {form.contacts.items.map((contact, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "12px",
                    marginBottom: "12px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Contact {index + 1}</span>
                    {form.contacts.items.length > 1 && mode !== "view" && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => removeContact(index)}
                        style={{ fontSize: "11px", padding: "2px 8px", background: "var(--danger)", color: "#fff" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="form-grid" style={{ border: "none", padding: 0 }}>
                    <div className="field">
                      <label>Contact Name<span className="req">*</span></label>
                      <input
                        value={contact.contact_name}
                        onChange={(e) => updateContact(index, "contact_name", e.target.value)}
                        placeholder="Full name"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>Designation<span className="req">*</span></label>
                      <input
                        value={contact.designation}
                        onChange={(e) => updateContact(index, "designation", e.target.value)}
                        placeholder="Job title"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>Department</label>
                      <input
                        value={contact.department}
                        onChange={(e) => updateContact(index, "department", e.target.value)}
                        placeholder="e.g., HR, Operations"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>Mobile Number<span className="req">*</span></label>
                      <input
                        value={contact.mobile}
                        onChange={(e) => updateContact(index, "mobile", e.target.value.replace(/\D/g, ""))}
                        placeholder="10-digit mobile"
                        maxLength={10}
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>Email Address<span className="req">*</span></label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateContact(index, "email", e.target.value)}
                        placeholder="email@company.com"
                        readOnly={mode === "view"}
                      />
                    </div>
                    <div className="field">
                      <label>Preferred Contact Method</label>
                      <select
                        value={contact.preferred_method}
                        onChange={(e) => updateContact(index, "preferred_method", e.target.value)}
                        disabled={mode === "view"}
                      >
                        {CONTACT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Required Candidate Information */}
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px", color: "var(--accent)" }}>
                Required Candidate Information & Documents
              </h3>
              <p style={{ fontSize: "11px", color: "#666", marginTop: 0, marginBottom: "12px" }}>
                Select which candidate details and documents must be mandatory when applying for this client's job openings.
                These requirements are automatically applied to all jobs created for this client.
              </p>

              {/* Information Fields grouped by category */}
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "12px",
                  marginBottom: "12px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "10px" }}>
                  📋 Mandatory Information Fields
                </div>
                {REQUIRED_FIELD_CATEGORIES.map((cat) => (
                  <div key={cat.category} style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#555", marginBottom: "4px" }}>
                      {cat.category}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {cat.fields.map((f) => (
                        <label
                          key={f.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "12px",
                            cursor: mode === "view" ? "default" : "pointer",
                            padding: "3px 6px",
                            borderRadius: "3px",
                            background: form.required_candidate_fields.fields.includes(f.key)
                              ? "#e6f7ff"
                              : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={form.required_candidate_fields.fields.includes(f.key)}
                            onChange={() => toggleRequiredField(f.key)}
                            disabled={mode === "view"}
                          />
                          <span>{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Required Documents */}
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "12px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "10px" }}>
                  📎 Mandatory Documents
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "6px",
                  }}
                >
                  {REQUIRED_DOCUMENT_OPTIONS.map((d) => (
                    <label
                      key={d.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        cursor: mode === "view" ? "default" : "pointer",
                        padding: "3px 6px",
                        borderRadius: "3px",
                        background: form.required_candidate_fields.documents.includes(d.key)
                          ? "#fff7e6"
                          : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.required_candidate_fields.documents.includes(d.key)}
                        onChange={() => toggleRequiredDocument(d.key)}
                        disabled={mode === "view"}
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(form.required_candidate_fields.fields.length > 0 ||
                form.required_candidate_fields.documents.length > 0) && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    background: "#f0f9ff",
                    borderLeft: "3px solid var(--accent)",
                    fontSize: "11px",
                    color: "#555",
                  }}
                >
                  <strong>Summary:</strong> {form.required_candidate_fields.fields.length} required
                  field(s) and {form.required_candidate_fields.documents.length} required document(s).
                  These will be enforced during candidate registration for this client's jobs.
                </div>
              )}
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {mode !== "view" && (
              <button className="btn primary" onClick={save} disabled={!form.company_name.trim()}>
                {mode === "edit" ? "Update Client" : "Save Client"}
              </button>
            )}
            <button className="btn" onClick={() => { setOpen(false); resetForm(); }}>
              {mode === "view" ? "Close" : "Cancel"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
