/**
 * Comprehensive Candidate Registration Wizard
 *
 * 11 sections following the SmartHire blue-collar staffing spec plus smart
 * features: PIN-code auto-fill, DOB→age, searchable role dropdown, salary
 * slider, photo capture from camera, save-and-continue via localStorage,
 * progress indicator, and per-language read/write/speak matrix.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useReference } from "../hooks/useReference";
import { PageHead } from "../components/ui";

const SECTIONS = [
  { key: "basic", label: "Basic Info" },
  { key: "address", label: "Address" },
  { key: "preferences", label: "Job Preferences" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Experience" },
  { key: "skills", label: "Skills" },
  { key: "documents", label: "Documents" },
  { key: "languages", label: "Languages" },
  { key: "additional", label: "Additional" },
  { key: "emergency", label: "Emergency" },
  { key: "declaration", label: "Declaration" },
] as const;

const SKILL_OPTIONS = [
  // Manufacturing & Technical Blue-Collar Skills
  "Electrician", "Plumber", "Welder", "Machine Operator", "CNC Operator",
  "Forklift Operator", "Assembly Work", "Quality Control", "Maintenance",
  "Equipment Operation", "Material Handling", "Industrial Safety",
  "Pressure Testing", "Hydraulics", "Pneumatics", "PLC Programming",
  "HVAC", "Electrical Wiring", "Circuit Board Assembly", "Soldering",
  "Precision Tooling", "Lathe Operation", "Milling", "Grinding",
  "Sheet Metal Work", "Fabrication", "Fitter", "Mason", "Carpenter",
  "Painter", "AC Technician", "Bar Bender",
];

const LANGUAGE_OPTIONS = [
  "Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Marathi", "Bengali", "Gujarati", "Punjabi", "Others",
];

const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Temporary"];
const WORK_LOCATIONS = ["Current City", "Anywhere in State", "Anywhere in India"];
const AVAILABILITY = ["Immediately", "Within 7 Days", "Within 15 Days", "Within 30 Days"];
const EDUCATION_LEVELS = [
  "Below 10th", "10th", "12th", "ITI", "Diploma", "Graduate", "Post Graduate",
];
const EXPERIENCE_BUCKETS = [
  "Fresher", "Less than 1 Year", "1–3 Years", "3–5 Years", "5+ Years",
];
const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed"];
const GENDERS = ["Male", "Female", "Other"];
const RELATIONSHIPS = ["Parent", "Spouse", "Sibling", "Child", "Relative", "Friend"];

const STORAGE_KEY = "smarthire.candidate.draft.v2";

interface LanguageProficiency {
  read: boolean;
  write: boolean;
  speak: boolean;
}

interface FormState {
  full_name: string;
  phone: string;
  phone_otp_verified: boolean;
  alt_phone: string;
  email: string;
  gender: string;
  date_of_birth: string;
  marital_status: string;
  father_or_husband_name: string;

  state: string;
  district: string;
  city: string;
  pincode: string;
  address: string;

  preferred_role: string;
  preferred_industry: string;
  employment_type: string;
  preferred_location: string;
  expected_salary: number;
  availability: string;

  highest_qualification: string;
  course_trade: string;
  year_of_passing: string;

  total_experience: string;
  current_company: string;
  current_role: string;
  current_salary: string;
  reason_for_leaving: string;

  skills: string[];

  aadhaar_number: string;
  aadhaar_verified: boolean;
  pan_number: string;
  pan_verified: boolean;
  driving_license_number: string;
  passport_available: string;
  
  // Bank Account Details
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_account_holder_name: string;
  bank_verified: boolean;
  
  // Document uploads
  resume_file_name: string;
  photo_data_url: string;
  aadhaar_doc: File | null;
  pan_doc: File | null;
  bank_statement_doc: File | null;
  education_certificates: File[];
  experience_letters: File[];

  languages_known: Record<string, LanguageProficiency>;

  willing_to_relocate: boolean;
  willing_to_shifts: boolean;
  willing_overtime: boolean;
  own_two_wheeler: boolean;
  own_four_wheeler: boolean;
  driving_license_available: boolean;
  physically_fit: boolean;
  medical_condition: string;

  emergency_name: string;
  emergency_relationship: string;
  emergency_phone: string;

  declaration_accepted: boolean;
  source: string;
}

const EMPTY_FORM: FormState = {
  full_name: "",
  phone: "",
  phone_otp_verified: false,
  alt_phone: "",
  email: "",
  gender: "",
  date_of_birth: "",
  marital_status: "",
  father_or_husband_name: "",
  source: "manual",
  state: "",
  district: "",
  city: "",
  pincode: "",
  address: "",
  preferred_role: "",
  preferred_industry: "",
  employment_type: "",
  preferred_location: "",
  expected_salary: 15000,
  availability: "",
  highest_qualification: "",
  course_trade: "",
  year_of_passing: "",
  total_experience: "",
  current_company: "",
  current_role: "",
  current_salary: "",
  reason_for_leaving: "",
  skills: [],
  aadhaar_number: "",
  aadhaar_verified: false,
  pan_number: "",
  pan_verified: false,
  driving_license_number: "",
  passport_available: "No",
  bank_account_number: "",
  bank_ifsc_code: "",
  bank_account_holder_name: "",
  bank_verified: false,
  resume_file_name: "",
  photo_data_url: "",
  aadhaar_doc: null,
  pan_doc: null,
  bank_statement_doc: null,
  education_certificates: [],
  experience_letters: [],
  languages_known: {},
  willing_to_relocate: false,
  willing_to_shifts: false,
  willing_overtime: false,
  own_two_wheeler: false,
  own_four_wheeler: false,
  driving_license_available: false,
  physically_fit: true,
  medical_condition: "",
  emergency_name: "",
  emergency_relationship: "",
  emergency_phone: "",
  declaration_accepted: false,
};

function loadDraft(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_FORM, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return EMPTY_FORM;
}

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function CandidateForm() {
  const ref = useReference();
  const navigate = useNavigate();
  const { id: candidateId } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  const jobId = searchParams.get("jobId");
  const driveId = searchParams.get("driveId");
  const isFieldAgent = user?.role === "field_agent";
  const isQuickMode = isFieldAgent && params.get("quick") === "1";
  const isEditMode = Boolean(candidateId);

  const [form, setForm] = useState<FormState>(() => loadDraft());
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [lookupPincode, setLookupPincode] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [jobInfo, setJobInfo] = useState<{
    title: string;
    company_name?: string;
    required_fields: string[];
    required_documents: string[];
  } | null>(null);
  const [driveInfo, setDriveInfo] = useState<{
    title: string;
    venue_name: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Load existing candidate data when editing (e.g., after quick registration).
  useEffect(() => {
    if (!candidateId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/candidates/${candidateId}`);
        if (cancelled) return;
        setForm((f) => ({
          ...f,
          full_name: data.full_name ?? f.full_name,
          phone: data.phone ?? f.phone,
          email: data.email ?? f.email,
          gender: data.gender ?? f.gender,
          date_of_birth: data.date_of_birth ?? f.date_of_birth,
          state: data.state ?? f.state,
          city: data.city ?? f.city,
          pincode: data.pincode ?? f.pincode,
          address: data.address ?? f.address,
          preferred_role: data.primary_trade ?? f.preferred_role,
          expected_salary: data.expected_salary ?? f.expected_salary,
          highest_qualification: data.education_level ?? f.highest_qualification,
          aadhaar_number: (data.profile_data?.documents?.aadhaar_number as string) ??
            data.aadhaar_last4 ??
            f.aadhaar_number,
          aadhaar_verified: !!data.profile_data?.aadhaar_verified,
          pan_number: (data.profile_data?.documents?.pan_number as string) ?? f.pan_number,
          pan_verified: !!data.profile_data?.pan_verified,
          bank_account_holder_name: (data.profile_data?.documents?.bank_account_holder_name as string) ?? f.bank_account_holder_name,
          bank_account_number: (data.profile_data?.documents?.bank_account_number as string) ?? f.bank_account_number,
          bank_ifsc_code: (data.profile_data?.documents?.bank_ifsc_code as string) ?? f.bank_ifsc_code,
          bank_verified: !!data.profile_data?.bank_verified,
        }));
      } catch {
        /* silent — fall back to draft / empty form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  // Fetch field-drive context (venue/title, and prefill city/state) if driveId provided
  useEffect(() => {
    if (!driveId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/field-drives/${driveId}`);
        if (cancelled) return;
        const d = res.data;
        setDriveInfo({ title: d.title, venue_name: d.venue_name });
        setForm((f) => ({
          ...f,
          city: f.city || d.city || "",
          state: f.state || d.state || "",
        }));
      } catch {
        /* silent — form still works without drive context */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driveId]);

  // Fetch job-specific mandatory field requirements (if jobId provided)
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const jobRes = await api.get(`/jobs/${jobId}`);
        if (cancelled) return;
        const jobData = jobRes.data;
        const req = jobData.required_candidate_fields || {};
        let companyName: string | undefined;
        try {
          if (jobData.employer_id) {
            const empRes = await api.get(`/employers/${jobData.employer_id}`);
            companyName = empRes.data?.company_name;
          }
        } catch {
          /* ignore employer fetch failure */
        }
        setJobInfo({
          title: jobData.title || "Job Opening",
          company_name: companyName,
          required_fields: Array.isArray(req.fields) ? req.fields : [],
          required_documents: Array.isArray(req.documents) ? req.documents : [],
        });
      } catch {
        /* silent — form still works without job context */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const requiredFields = jobInfo?.required_fields ?? [];
  const requiredDocuments = jobInfo?.required_documents ?? [];
  const isFieldRequired = (key: string) => requiredFields.includes(key);
  const isDocumentRequired = (key: string) => requiredDocuments.includes(key);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore quota errors */
    }
  }, [form]);

  const age = useMemo(() => calculateAge(form.date_of_birth), [form.date_of_birth]);
  const progress = Math.round(((step + 1) / SECTIONS.length) * 100);

  async function lookupPin(pin: string) {
    if (!/^\d{6}$/.test(pin)) return;
    setLookupPincode(true);
    try {
      const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await r.json();
      const office = data?.[0]?.PostOffice?.[0];
      if (office) {
        setForm((f) => ({
          ...f,
          state: office.State || f.state,
          district: office.District || f.district,
          city: f.city || office.Block || office.Name,
        }));
        setInfo(`Address auto-filled from PIN ${pin}`);
        setTimeout(() => setInfo(""), 3000);
      }
    } catch {
      /* silently fail — user can enter manually */
    } finally {
      setLookupPincode(false);
    }
  }

  function toggleSkill(skill: string) {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }));
  }

  function addCustomSkill() {
    const trimmed = customSkillInput.trim();
    if (!trimmed) {
      setError("Enter a skill name.");
      return;
    }
    if (form.skills.includes(trimmed)) {
      setError("This skill is already added.");
      return;
    }
    setError("");
    setForm((f) => ({
      ...f,
      skills: [...f.skills, trimmed],
    }));
    setCustomSkillInput("");
    setInfo(`Skill "${trimmed}" added!`);
    setTimeout(() => setInfo(""), 2000);
  }

  function removeSkill(skill: string) {
    setForm((f) => ({
      ...f,
      skills: f.skills.filter((s) => s !== skill),
    }));
  }

  function toggleLanguage(lang: string) {
    setForm((f) => {
      const next = { ...f.languages_known };
      if (next[lang]) delete next[lang];
      else next[lang] = { read: false, write: false, speak: true };
      return { ...f, languages_known: next };
    });
  }

  function setLangProficiency(
    lang: string,
    key: keyof LanguageProficiency,
    val: boolean
  ) {
    setForm((f) => ({
      ...f,
      languages_known: {
        ...f.languages_known,
        [lang]: { ...f.languages_known[lang], [key]: val },
      },
    }));
  }

  function sendOtp() {
    if (!/^\d{10}$/.test(form.phone)) {
      setError("Enter a valid 10-digit mobile number to receive OTP.");
      return;
    }
    setError("");
    setOtpSent(true);
    setInfo("OTP sent (demo mode — enter any 6 digits to verify).");
    setTimeout(() => setInfo(""), 4000);
  }

  function verifyOtp() {
    if (!/^\d{6}$/.test(otpInput)) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    set("phone_otp_verified", true);
    setError("");
    setInfo("Mobile number verified ✓");
    setTimeout(() => setInfo(""), 3000);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("photo_data_url", String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("resume_file_name", file.name);
  }

  function validateStep(idx: number): string | null {
    const s = SECTIONS[idx].key;
    if (s === "basic") {
      if (!form.full_name.trim() || !form.phone.trim()) {
        alert("mandatory fields should be filled");
        return "mandatory fields should be filled";
      }
      if (!/^\d{10}$/.test(form.phone)) return "Enter a valid 10-digit mobile number.";
    }
    if (s === "address") {
      if (!form.state) return "State is required.";
      if (!form.district) return "District is required.";
      if (!form.city) return "City/Town/Village is required.";
      if (!/^\d{6}$/.test(form.pincode)) return "Enter a valid 6-digit PIN code.";
    }
    if (s === "preferences" && !form.preferred_role) {
      return "Preferred Job Role is required.";
    }
    if (s === "declaration" && !form.declaration_accepted) {
      return "Please accept the declaration to submit.";
    }

    // Employer-mandated field checks (only when applying against a specific job)
    const employerErr = validateEmployerRequirements(s);
    if (employerErr) return employerErr;

    return null;
  }

  function validateEmployerRequirements(sectionKey: string): string | null {
    if (!jobInfo) return null;
    const clientName = jobInfo.company_name || "this client";

    // Map field keys to (section, human label, "is missing" test)
    const fieldRules: Record<
      string,
      { section: string; label: string; missing: () => boolean }
    > = {
      full_name: { section: "basic", label: "Full Name", missing: () => !form.full_name.trim() },
      phone: { section: "basic", label: "Mobile Number", missing: () => !/^\d{10}$/.test(form.phone) },
      alt_phone: { section: "basic", label: "Alternate Phone", missing: () => !form.alt_phone.trim() },
      email: { section: "basic", label: "Email Address", missing: () => !form.email.trim() },
      gender: { section: "basic", label: "Gender", missing: () => !form.gender },
      date_of_birth: { section: "basic", label: "Date of Birth", missing: () => !form.date_of_birth },
      marital_status: { section: "basic", label: "Marital Status", missing: () => !form.marital_status },
      father_or_husband_name: {
        section: "basic",
        label: "Father/Husband Name",
        missing: () => !form.father_or_husband_name.trim(),
      },
      state: { section: "address", label: "State", missing: () => !form.state },
      district: { section: "address", label: "District", missing: () => !form.district },
      city: { section: "address", label: "City", missing: () => !form.city },
      pincode: { section: "address", label: "PIN Code", missing: () => !/^\d{6}$/.test(form.pincode) },
      address: { section: "address", label: "Complete Address", missing: () => !form.address.trim() },
      aadhaar_number: {
        section: "documents",
        label: "Aadhaar Number",
        missing: () => !/^\d{12}$/.test(form.aadhaar_number.replace(/\D/g, "")),
      },
      pan_number: {
        section: "documents",
        label: "PAN Number",
        missing: () => !form.pan_number.trim(),
      },
      driving_license_number: {
        section: "documents",
        label: "Driving License Number",
        missing: () => !form.driving_license_number.trim(),
      },
      passport_available: {
        section: "documents",
        label: "Passport",
        missing: () => !form.passport_available || form.passport_available === "No",
      },
      bank_account_number: {
        section: "documents",
        label: "Bank Account Number",
        missing: () => !form.bank_account_number.trim(),
      },
      bank_ifsc_code: {
        section: "documents",
        label: "IFSC Code",
        missing: () => !form.bank_ifsc_code.trim(),
      },
      bank_account_holder_name: {
        section: "documents",
        label: "Account Holder Name",
        missing: () => !form.bank_account_holder_name.trim(),
      },
      highest_qualification: {
        section: "education",
        label: "Highest Qualification",
        missing: () => !form.highest_qualification,
      },
      course_trade: {
        section: "education",
        label: "Course/Trade",
        missing: () => !form.course_trade.trim(),
      },
      year_of_passing: {
        section: "education",
        label: "Year of Passing",
        missing: () => !form.year_of_passing.trim(),
      },
      total_experience: {
        section: "experience",
        label: "Total Experience",
        missing: () => !form.total_experience,
      },
      current_company: {
        section: "experience",
        label: "Current Company",
        missing: () => !form.current_company.trim(),
      },
      current_role: {
        section: "experience",
        label: "Current Role",
        missing: () => !form.current_role.trim(),
      },
      current_salary: {
        section: "experience",
        label: "Current Salary",
        missing: () => !form.current_salary.trim(),
      },
      skills: { section: "skills", label: "Skills", missing: () => form.skills.length === 0 },
      languages_known: {
        section: "languages",
        label: "Languages Known",
        missing: () => Object.keys(form.languages_known).length === 0,
      },
      emergency_name: {
        section: "emergency",
        label: "Emergency Contact Name",
        missing: () => !form.emergency_name.trim(),
      },
      emergency_phone: {
        section: "emergency",
        label: "Emergency Contact Phone",
        missing: () => !/^\d{10}$/.test(form.emergency_phone),
      },
    };

    for (const key of requiredFields) {
      const rule = fieldRules[key];
      if (!rule) continue;
      if (rule.section !== sectionKey) continue;
      if (rule.missing()) {
        return `${rule.label} is required by ${clientName}.`;
      }
    }

    const docRules: Record<string, { label: string; missing: () => boolean }> = {
      photo_data_url: { label: "Candidate Photo", missing: () => !form.photo_data_url },
      resume_file_name: { label: "Resume/CV", missing: () => !form.resume_file_name },
      aadhaar_doc: { label: "Aadhaar Card Copy", missing: () => !form.aadhaar_doc },
      pan_doc: { label: "PAN Card Copy", missing: () => !form.pan_doc },
      bank_statement_doc: {
        label: "Bank Statement/Passbook",
        missing: () => !form.bank_statement_doc,
      },
      education_certificates: {
        label: "Education Certificates",
        missing: () => form.education_certificates.length === 0,
      },
      experience_letters: {
        label: "Experience Letters",
        missing: () => form.experience_letters.length === 0,
      },
    };

    if (sectionKey === "documents") {
      for (const key of requiredDocuments) {
        const rule = docRules[key];
        if (!rule) continue;
        if (rule.missing()) {
          return `${rule.label} is required by ${clientName}.`;
        }
      }
    }

    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(SECTIONS.length - 1, s + 1));
  }

  function prev() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    for (let i = 0; i < SECTIONS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setError(err);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const aadhaar = form.aadhaar_number.replace(/\D/g, "");
      const experienceMap: Record<string, number> = {
        Fresher: 0,
        "Less than 1 Year": 0,
        "1–3 Years": 2,
        "3–5 Years": 4,
        "5+ Years": 6,
      };

      const payload = {
        full_name: form.full_name.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        aadhaar_last4: aadhaar.length >= 4 ? aadhaar.slice(-4) : null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        primary_trade: form.preferred_role || null,
        experience_years: experienceMap[form.total_experience] ?? 0,
        education_level: form.highest_qualification || null,
        certification: null,
        languages: Object.keys(form.languages_known).join(", ") || null,
        expected_salary: form.expected_salary || null,
        has_driving_license: form.driving_license_available,
        willing_to_relocate: form.willing_to_relocate,
        notes: null,
        source: form.source || (user?.role === "field_agent" ? "field_agent" : "manual"),
        field_drive_id: driveId ? Number(driveId) : null,
        profile_data: {
          aadhaar_verified: form.aadhaar_verified,
          pan_verified: form.pan_verified,
          bank_verified: form.bank_verified,
          alt_phone: form.alt_phone,
          marital_status: form.marital_status,
          father_or_husband_name: form.father_or_husband_name,
          district: form.district,
          phone_otp_verified: form.phone_otp_verified,
          job_preferences: {
            preferred_industry: form.preferred_industry,
            employment_type: form.employment_type,
            preferred_location: form.preferred_location,
            availability: form.availability,
          },
          education: {
            course_trade: form.course_trade,
            year_of_passing: form.year_of_passing,
          },
          work_experience: {
            total_experience: form.total_experience,
            current_company: form.current_company,
            current_role: form.current_role,
            current_salary: form.current_salary,
            reason_for_leaving: form.reason_for_leaving,
          },
          skills: form.skills,
          documents: {
            aadhaar_number: aadhaar,
            pan_number: form.pan_number,
            driving_license_number: form.driving_license_number,
            passport_available: form.passport_available,
            resume_file_name: form.resume_file_name,
            has_photo: !!form.photo_data_url,
            bank_account_number: form.bank_account_number,
            bank_ifsc_code: form.bank_ifsc_code,
            bank_account_holder_name: form.bank_account_holder_name,
          },
          languages_known: form.languages_known,
          additional_info: {
            willing_to_shifts: form.willing_to_shifts,
            willing_overtime: form.willing_overtime,
            own_two_wheeler: form.own_two_wheeler,
            own_four_wheeler: form.own_four_wheeler,
            physically_fit: form.physically_fit,
            medical_condition: form.medical_condition,
          },
          emergency_contact: {
            name: form.emergency_name,
            relationship: form.emergency_relationship,
            phone: form.emergency_phone,
          },
          declaration_accepted: form.declaration_accepted,
          declaration_at: new Date().toISOString(),
        },
      };

      if (candidateId) {
        await api.patch(`/candidates/${candidateId}`, payload);
      } else {
        await api.post("/candidates", payload);
      }

      localStorage.removeItem(STORAGE_KEY);
      navigate("/candidates");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Could not save candidate");
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    if (!confirm("Discard the saved draft and start over?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setForm(EMPTY_FORM);
    setStep(0);
    setOtpSent(false);
    setOtpInput("");
  }

  const currentSection = SECTIONS[step].key;

  async function submitQuick() {
    const phone = form.phone.replace(/\D/g, "");
    if (!form.full_name.trim() || !phone.trim()) {
      alert("mandatory fields should be filled");
      return setError("mandatory fields should be filled");
    }
    if (!/^\d{10}$/.test(phone)) return setError("Enter a valid 10-digit mobile number.");
    
    // Email is optional, but if filled must be valid
    if (form.email.trim()) {
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(form.email)) return setError("Enter a valid email address.");
    }
    
    // Aadhaar is optional, but if filled must be 12 digits
    const aadhaar = form.aadhaar_number.replace(/\D/g, "");
    if (aadhaar && aadhaar.length !== 12) return setError("Enter a valid 12-digit Aadhaar number.");

    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ id: number }>("/candidates/quick", {
        full_name: form.full_name.trim(),
        phone,
        email: form.email.trim(),
        aadhaar_last4: aadhaar.slice(-4),
        city: form.city || null,
        state: form.state || null,
        primary_trade: form.preferred_role || null,
        field_drive_id: driveId ? Number(driveId) : null,
      });
      localStorage.removeItem(STORAGE_KEY);
      navigate(`/candidates/${data.id}/edit?quick=0`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Could not save candidate");
    } finally {
      setBusy(false);
    }
  }

  if (isQuickMode) {
    return (
      <div>
        <PageHead
          title="Quick Register Candidate"
          breadcrumb="Field Operations › Quick Register"
          actions={
            <button className="btn" type="button" onClick={() => navigate("/candidates")}>
              Back
            </button>
          }
        />
        {driveInfo && (
          <div className="success-note" style={{ marginBottom: 12 }}>
            📍 Quick registration for field drive <strong>{driveInfo.title}</strong> at{" "}
            {driveInfo.venue_name}.
          </div>
        )}
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-head">Basic Details</div>
          <div className="card-body">
            <p className="muted">
              Name and Mobile are required. The full profile can be completed later.
            </p>
            {error && <div className="error-note" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="form-grid">
              <div className="field">
                <label>Full Name<span className="req">*</span></label>
                <input
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="As per Aadhaar"
                />
              </div>
              <div className="field">
                <label>Mobile Number<span className="req">*</span></label>
                <input
                  value={form.phone}
                  maxLength={10}
                  onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit"
                />
              </div>
              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="field">
                <label>Aadhaar Number</label>
                <input
                  value={form.aadhaar_number}
                  maxLength={12}
                  onChange={(e) => set("aadhaar_number", e.target.value.replace(/\D/g, ""))}
                  placeholder="12-digit Aadhaar"
                />
                <span className="muted" style={{ fontSize: 11 }}>Only last 4 digits are stored.</span>
              </div>
              <div className="field">
                <label>Preferred Job Role / Trade</label>
                <input
                  list="role-options"
                  value={form.preferred_role}
                  onChange={(e) => set("preferred_role", e.target.value)}
                  placeholder="Start typing…"
                />
                <datalist id="role-options">
                  {ref?.job_categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="field">
                <label>State</label>
                <select value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select…</option>
                  {ref?.states.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>City / Town / Village</label>
                <input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <button className="btn primary" onClick={submitQuick} disabled={busy}>
                {busy ? "Saving…" : "Save & Continue to Full Profile"}
              </button>
              <button className="btn" onClick={() => navigate("/candidates")} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="Register Candidate"
        breadcrumb="Candidate Data Bank › Register Candidate"
        actions={
          <button className="btn" type="button" onClick={resetDraft}>
            Reset Draft
          </button>
        }
      />

      {driveInfo && (
        <div className="success-note" style={{ marginBottom: 12 }}>
          📍 Registering on-the-spot for field drive <strong>{driveInfo.title}</strong> at{" "}
          {driveInfo.venue_name}. This candidate will be recorded with source{" "}
          <strong>Field Agent</strong>.
        </div>
      )}

      {jobInfo && (jobInfo.required_fields.length > 0 || jobInfo.required_documents.length > 0) && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fff7e6",
            border: "1px solid #ffd591",
            borderLeft: "4px solid #fa8c16",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "6px", color: "#873800" }}>
            ⚠️ Client-Specific Requirements — {jobInfo.company_name || "This Client"} ({jobInfo.title})
          </div>
          <div style={{ color: "#555" }}>
            The following are <strong>mandatory</strong> for this job opening:
            {jobInfo.required_fields.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <strong>Information:</strong> {jobInfo.required_fields.join(", ")}
              </div>
            )}
            {jobInfo.required_documents.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <strong>Documents:</strong> {jobInfo.required_documents.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="wizard-progress">
        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="wizard-progress-label">
          Step {step + 1} of {SECTIONS.length} — {SECTIONS[step].label} ({progress}%)
        </div>
      </div>

      <div className="wizard-steps">
        {SECTIONS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={
              "wizard-step" +
              (i === step ? " active" : "") +
              (i < step ? " done" : "")
            }
            onClick={() => setStep(i)}
          >
            <span className="wizard-step-num">{i + 1}</span>
            <span className="wizard-step-label">{s.label}</span>
          </button>
        ))}
      </div>

      {error && <div className="error-note">{error}</div>}
      {info && <div className="success-note">{info}</div>}

      <div className="wizard-body">
        {currentSection === "basic" && (
          <div className="form-grid">
            <div className="field">
              <label>Full Name<span className="req">*</span></label>
              <input
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="As per Aadhaar"
              />
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select…</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mobile Number<span className="req">*</span></label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={form.phone}
                  maxLength={10}
                  onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit"
                  disabled={form.phone_otp_verified}
                />
                {!form.phone_otp_verified && (
                  <button className="btn" type="button" onClick={sendOtp} disabled={otpSent}>
                    {otpSent ? "Resend" : "Send OTP"}
                  </button>
                )}
                {form.phone_otp_verified && (
                  <span className="badge green" style={{ alignSelf: "center" }}>Verified</span>
                )}
              </div>
              {otpSent && !form.phone_otp_verified && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    value={otpInput}
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  />
                  <button className="btn primary" type="button" onClick={verifyOtp}>
                    Verify
                  </button>
                </div>
              )}
            </div>
            <div className="field">
              <label>Alternate Mobile Number</label>
              <input
                value={form.alt_phone}
                maxLength={10}
                onChange={(e) => set("alt_phone", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="field">
              <label>Email Address{isFieldAgent && <span className="req">*</span>}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
              {age !== null && (
                <span className="muted" style={{ fontSize: 11 }}>Age: {age} years</span>
              )}
            </div>
            <div className="field">
              <label>Marital Status</label>
              <select
                value={form.marital_status}
                onChange={(e) => set("marital_status", e.target.value)}
              >
                <option value="">Select…</option>
                {MARITAL_STATUS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Father's / Husband's Name</label>
              <input
                value={form.father_or_husband_name}
                onChange={(e) => set("father_or_husband_name", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Registration Source (Platform)</label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
              >
                <option value="manual">Manual Entry / Staffing Portal</option>
                <option value="website">Website / Online Application</option>
                <option value="social_media">Social Media / Campaign</option>
                <option value="field_agent">Field Agent / Registration Drive</option>
                <option value="qr_self_registration">QR Self Registration</option>
                <option value="institution_upload">Institution Upload</option>
                <option value="inbound_webhook">Inbound Webhook / Lead</option>
              </select>
            </div>
          </div>
        )}

        {currentSection === "address" && (
          <div className="form-grid">
            <div className="field">
              <label>PIN Code<span className="req">*</span></label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={form.pincode}
                  maxLength={6}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                  onBlur={(e) => lookupPin(e.target.value)}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => lookupPin(form.pincode)}
                  disabled={lookupPincode}
                >
                  {lookupPincode ? "Looking up…" : "Auto-fill"}
                </button>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>
                State, District auto-fill from PIN.
              </span>
            </div>
            <div className="field">
              <label>State<span className="req">*</span></label>
              <select value={form.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">Select…</option>
                {ref?.states.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>District<span className="req">*</span></label>
              <input
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
              />
            </div>
            <div className="field">
              <label>City / Town / Village<span className="req">*</span></label>
              <input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="field full">
              <label>Current Address</label>
              <textarea
                rows={3}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="House no, street, landmark…"
              />
            </div>
          </div>
        )}

        {currentSection === "preferences" && (
          <div className="form-grid">
            <div className="field">
              <label>Preferred Job Role<span className="req">*</span></label>
              <input
                list="role-options"
                value={form.preferred_role}
                onChange={(e) => set("preferred_role", e.target.value)}
                placeholder="Start typing…"
              />
              <datalist id="role-options">
                {ref?.job_categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Preferred Industry</label>
              <input
                value={form.preferred_industry}
                onChange={(e) => set("preferred_industry", e.target.value)}
                placeholder="e.g. Manufacturing, Logistics"
              />
            </div>
            <div className="field">
              <label>Employment Type</label>
              <select
                value={form.employment_type}
                onChange={(e) => set("employment_type", e.target.value)}
              >
                <option value="">Select…</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Preferred Work Location</label>
              <select
                value={form.preferred_location}
                onChange={(e) => set("preferred_location", e.target.value)}
              >
                <option value="">Select…</option>
                {WORK_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field full">
              <label>
                Expected Monthly Salary: ₹{form.expected_salary.toLocaleString("en-IN")}
              </label>
              <input
                type="range"
                min={5000}
                max={100000}
                step={1000}
                value={form.expected_salary}
                onChange={(e) => set("expected_salary", Number(e.target.value))}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }} className="muted">
                <span>₹5,000</span>
                <span>₹1,00,000</span>
              </div>
            </div>
            <div className="field">
              <label>Available to Join</label>
              <select
                value={form.availability}
                onChange={(e) => set("availability", e.target.value)}
              >
                <option value="">Select…</option>
                {AVAILABILITY.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}

        {currentSection === "education" && (
          <div className="form-grid">
            <div className="field">
              <label>Highest Qualification</label>
              <select
                value={form.highest_qualification}
                onChange={(e) => set("highest_qualification", e.target.value)}
              >
                <option value="">Select…</option>
                {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Course / Trade</label>
              <input
                value={form.course_trade}
                onChange={(e) => set("course_trade", e.target.value)}
                placeholder="e.g. ITI Electrician"
              />
            </div>
            <div className="field">
              <label>Year of Passing</label>
              <input
                type="number"
                min={1950}
                max={new Date().getFullYear() + 1}
                value={form.year_of_passing}
                onChange={(e) => set("year_of_passing", e.target.value)}
              />
            </div>
          </div>
        )}

        {currentSection === "experience" && (
          <div className="form-grid">
            <div className="field">
              <label>Total Experience</label>
              <select
                value={form.total_experience}
                onChange={(e) => set("total_experience", e.target.value)}
              >
                <option value="">Select…</option>
                {EXPERIENCE_BUCKETS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Current / Last Company</label>
              <input
                value={form.current_company}
                onChange={(e) => set("current_company", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Current Job Role</label>
              <input
                value={form.current_role}
                onChange={(e) => set("current_role", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Current Salary (₹ / month)</label>
              <input
                type="number"
                min={0}
                value={form.current_salary}
                onChange={(e) => set("current_salary", e.target.value)}
              />
            </div>
            <div className="field full">
              <label>Reason for Leaving</label>
              <textarea
                rows={2}
                value={form.reason_for_leaving}
                onChange={(e) => set("reason_for_leaving", e.target.value)}
              />
            </div>
          </div>
        )}

        {currentSection === "skills" && (
          <div className="wizard-panel">
            <p className="muted" style={{ marginTop: 0 }}>
              Select predefined skills or add your own. Multiple selection allowed.
            </p>

            {/* Added Skills Summary */}
            {form.skills.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: "#e6f4ea", borderRadius: 4, border: "1px solid #bfe3cb" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  Selected Skills ({form.skills.length}):
                </div>
                <div className="chip-grid">
                  {form.skills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip active"
                      onClick={() => removeSkill(s)}
                      title="Click to remove"
                    >
                      ✓ {s} <span style={{ marginLeft: 4 }}>×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Predefined Skills */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                Predefined Skills:
              </div>
              <div className="chip-grid">
                {SKILL_OPTIONS.map((s) => {
                  const active = form.skills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={"chip" + (active ? " active" : "")}
                      onClick={() => toggleSkill(s)}
                    >
                      {active ? "✓ " : ""}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Skill Input */}
            <div style={{ padding: 12, background: "#fdf6e3", borderRadius: 4, border: "1px solid #f0e3b8" }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block" }}>
                Add Custom Skill (e.g., "Advanced Welding", "Python Scripting"):
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      addCustomSkill();
                      e.preventDefault();
                    }
                  }}
                  placeholder="Type a skill and press Enter or click Add"
                  style={{ flex: 1 }}
                />
                <button className="btn primary" type="button" onClick={addCustomSkill}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {currentSection === "documents" && (
          <div className="wizard-panel">
            <h2>Documents & KYC Verification</h2>
            
            {/* Aadhaar Section */}
            <div className="form-group" style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--accent)" }}>Aadhaar Card</h3>
              <div className="form-row">
                <div className="field">
                  <label>Aadhaar Number *</label>
                  <input
                    value={form.aadhaar_number}
                    maxLength={12}
                    onChange={(e) => set("aadhaar_number", e.target.value.replace(/\D/g, ""))}
                    placeholder="12-digit Aadhaar number"
                  />
                  <span className="muted" style={{ fontSize: 11 }}>
                    Only last 4 digits are stored server-side for security.
                  </span>
                </div>
                <div className="field">
                  <label>Upload Aadhaar Card (PDF/Image)</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) set("aadhaar_doc", file);
                    }}
                  />
                  {form.aadhaar_doc && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Selected: {form.aadhaar_doc.name}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    if (!form.aadhaar_number || form.aadhaar_number.length !== 12) {
                      alert("Please enter a valid 12-digit Aadhaar number");
                      return;
                    }
                    if (!form.full_name) {
                      alert("Please enter your full name first");
                      return;
                    }
                    try {
                      const res = await api.post("/kyc/verify/aadhaar", {
                        aadhaar_number: form.aadhaar_number,
                        name: form.full_name,
                        dob: form.date_of_birth || null,
                        mobile: form.phone || null,
                      });
                      if (res.data.verified) {
                        set("aadhaar_verified", true);
                        alert(`✓ Aadhaar verified successfully! ${res.data.note || ""}`);
                      } else {
                        alert(`✗ Aadhaar verification failed: ${res.data.error || "Unknown error"}`);
                      }
                    } catch (err: any) {
                      alert(`Error: ${err.response?.data?.detail || err.message}`);
                    }
                  }}
                  disabled={form.aadhaar_verified}
                >
                  {form.aadhaar_verified ? "✓ Verified" : "Verify Aadhaar via AUA"}
                </button>
                {form.aadhaar_verified && (
                  <span style={{ marginLeft: "12px", color: "var(--success)", fontWeight: 600 }}>
                    ✓ Aadhaar Verified
                  </span>
                )}
              </div>
            </div>

            {/* PAN Section */}
            <div className="form-group" style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--accent)" }}>PAN Card</h3>
              <div className="form-row">
                <div className="field">
                  <label>PAN Number *</label>
                  <input
                    value={form.pan_number}
                    maxLength={10}
                    onChange={(e) => set("pan_number", e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="field">
                  <label>Upload PAN Card (PDF/Image)</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) set("pan_doc", file);
                    }}
                  />
                  {form.pan_doc && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Selected: {form.pan_doc.name}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    if (!form.pan_number || form.pan_number.length !== 10) {
                      alert("Please enter a valid 10-character PAN number");
                      return;
                    }
                    if (!form.full_name) {
                      alert("Please enter your full name first");
                      return;
                    }
                    try {
                      const res = await api.post("/kyc/verify/pan", {
                        pan_number: form.pan_number,
                        name: form.full_name,
                        dob: form.date_of_birth || null,
                      });
                      if (res.data.verified) {
                        set("pan_verified", true);
                        alert(`✓ PAN verified successfully! Status: ${res.data.pan_status || "active"}. ${res.data.note || ""}`);
                      } else {
                        alert(`✗ PAN verification failed: ${res.data.error || "Unknown error"}`);
                      }
                    } catch (err: any) {
                      alert(`Error: ${err.response?.data?.detail || err.message}`);
                    }
                  }}
                  disabled={form.pan_verified}
                >
                  {form.pan_verified ? "✓ Verified" : "Verify PAN"}
                </button>
                {form.pan_verified && (
                  <span style={{ marginLeft: "12px", color: "var(--success)", fontWeight: 600 }}>
                    ✓ PAN Verified
                  </span>
                )}
              </div>
            </div>

            {/* Bank Account Section */}
            <div className="form-group" style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "4px", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--accent)" }}>Bank Account Details</h3>
              <div className="form-row">
                <div className="field">
                  <label>Account Holder Name *</label>
                  <input
                    value={form.bank_account_holder_name}
                    onChange={(e) => set("bank_account_holder_name", e.target.value)}
                    placeholder="Name as per bank records"
                  />
                </div>
                <div className="field">
                  <label>Account Number *</label>
                  <input
                    value={form.bank_account_number}
                    onChange={(e) => set("bank_account_number", e.target.value.replace(/\D/g, ""))}
                    placeholder="Bank account number"
                  />
                </div>
                <div className="field">
                  <label>IFSC Code *</label>
                  <input
                    value={form.bank_ifsc_code}
                    maxLength={11}
                    onChange={(e) => set("bank_ifsc_code", e.target.value.toUpperCase())}
                    placeholder="ABCD0123456"
                  />
                </div>
                <div className="field">
                  <label>Upload Bank Statement/Cancelled Cheque</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) set("bank_statement_doc", file);
                    }}
                  />
                  {form.bank_statement_doc && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Selected: {form.bank_statement_doc.name}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    if (!form.bank_account_number || !form.bank_ifsc_code || !form.bank_account_holder_name) {
                      alert("Please fill all bank account details");
                      return;
                    }
                    try {
                      const res = await api.post("/kyc/verify/bank", {
                        account_number: form.bank_account_number,
                        ifsc_code: form.bank_ifsc_code,
                        account_holder_name: form.bank_account_holder_name,
                      });
                      if (res.data.verified) {
                        set("bank_verified", true);
                        alert(`✓ Bank account verified! Bank: ${res.data.bank_name || ""}. ${res.data.note || ""}`);
                      } else {
                        alert(`✗ Bank verification failed: ${res.data.error || "Unknown error"}`);
                      }
                    } catch (err: any) {
                      alert(`Error: ${err.response?.data?.detail || err.message}`);
                    }
                  }}
                  disabled={form.bank_verified}
                >
                  {form.bank_verified ? "✓ Verified" : "Verify Bank Account"}
                </button>
                {form.bank_verified && (
                  <span style={{ marginLeft: "12px", color: "var(--success)", fontWeight: 600 }}>
                    ✓ Bank Account Verified
                  </span>
                )}
              </div>
            </div>

            {/* Other Documents */}
            <div className="form-row">
              <div className="field">
                <label>Driving License Number</label>
                <input
                  value={form.driving_license_number}
                  onChange={(e) => set("driving_license_number", e.target.value)}
                  placeholder="DL number (if applicable)"
                />
              </div>
              <div className="field">
                <label>Passport Available</label>
                <select
                  value={form.passport_available}
                  onChange={(e) => set("passport_available", e.target.value)}
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
            </div>

            {/* Education Certificates */}
            <div className="form-group" style={{ marginTop: "16px" }}>
              <label>Education Certificates (10th, 12th, Diploma, Degree, etc.)</label>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  set("education_certificates", files);
                }}
              />
              {form.education_certificates.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    Selected {form.education_certificates.length} file(s)
                  </span>
                  <ul style={{ fontSize: "11px", marginTop: "4px", paddingLeft: "20px" }}>
                    {form.education_certificates.map((file, idx) => (
                      <li key={idx}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Experience Letters */}
            <div className="form-group">
              <label>Experience Letters / Relieving Letters</label>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  set("experience_letters", files);
                }}
              />
              {form.experience_letters.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    Selected {form.experience_letters.length} file(s)
                  </span>
                  <ul style={{ fontSize: "11px", marginTop: "4px", paddingLeft: "20px" }}>
                    {form.experience_letters.map((file, idx) => (
                      <li key={idx}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Resume and Photo */}
            <div className="form-row">
              <div className="field">
                <label>Resume Upload (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  ref={resumeInputRef}
                  onChange={handleResume}
                />
                {form.resume_file_name && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    Attached: {form.resume_file_name}
                  </span>
                )}
              </div>
              <div className="field">
                <label>Profile Photograph</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={photoInputRef}
                  onChange={handlePhoto}
                />
                {form.photo_data_url && (
                  <img
                    src={form.photo_data_url}
                    alt="Candidate"
                    style={{
                      marginTop: 6,
                      width: 96,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {currentSection === "languages" && (
          <div className="wizard-panel">
            <p className="muted" style={{ marginTop: 0 }}>
              Tick each language known, then mark Read / Write / Speak proficiency.
            </p>
            <table className="sn-table" style={{ marginTop: 4 }}>
              <thead>
                <tr>
                  <th>Language</th>
                  <th style={{ width: 80, textAlign: "center" }}>Read</th>
                  <th style={{ width: 80, textAlign: "center" }}>Write</th>
                  <th style={{ width: 80, textAlign: "center" }}>Speak</th>
                </tr>
              </thead>
              <tbody>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const prof = form.languages_known[lang];
                  const active = !!prof;
                  return (
                    <tr key={lang}>
                      <td>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleLanguage(lang)}
                          />
                          {lang}
                        </label>
                      </td>
                      {(["read", "write", "speak"] as const).map((k) => (
                        <td key={k} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            disabled={!active}
                            checked={active && prof![k]}
                            onChange={(e) => setLangProficiency(lang, k, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {currentSection === "additional" && (
          <div className="form-grid">
            {(
              [
                ["willing_to_relocate", "Willing to Relocate"],
                ["willing_to_shifts", "Willing to Work in Shifts"],
                ["willing_overtime", "Willing to Work Overtime"],
                ["own_two_wheeler", "Own Two Wheeler"],
                ["own_four_wheeler", "Own Four Wheeler"],
                ["driving_license_available", "Driving License Available"],
                ["physically_fit", "Physically Fit for Field Work"],
              ] as const
            ).map(([key, label]) => (
              <div className="field checkbox" key={key}>
                <input
                  type="checkbox"
                  id={key}
                  checked={form[key] as boolean}
                  onChange={(e) => set(key, e.target.checked as any)}
                />
                <label htmlFor={key}>{label}</label>
              </div>
            ))}
            <div className="field full">
              <label>Any Medical Condition</label>
              <textarea
                rows={2}
                value={form.medical_condition}
                onChange={(e) => set("medical_condition", e.target.value)}
                placeholder="Optional — leave blank if none"
              />
            </div>
          </div>
        )}

        {currentSection === "emergency" && (
          <div className="form-grid">
            <div className="field">
              <label>Contact Person Name</label>
              <input
                value={form.emergency_name}
                onChange={(e) => set("emergency_name", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Relationship</label>
              <select
                value={form.emergency_relationship}
                onChange={(e) => set("emergency_relationship", e.target.value)}
              >
                <option value="">Select…</option>
                {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mobile Number</label>
              <input
                value={form.emergency_phone}
                maxLength={10}
                onChange={(e) => set("emergency_phone", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
        )}

        {currentSection === "declaration" && (
          <div className="wizard-panel">
            <h3 style={{ marginTop: 0 }}>Review & Declaration</h3>
            <div className="review-grid">
              <div><strong>Name:</strong> {form.full_name || "—"}</div>
              <div><strong>Mobile:</strong> {form.phone || "—"} {form.phone_otp_verified && "✓"}</div>
              <div><strong>DOB:</strong> {form.date_of_birth || "—"} {age !== null && `(${age}y)`}</div>
              <div><strong>Gender:</strong> {form.gender || "—"}</div>
              <div><strong>Location:</strong> {[form.city, form.district, form.state, form.pincode].filter(Boolean).join(", ") || "—"}</div>
              <div><strong>Preferred Role:</strong> {form.preferred_role || "—"}</div>
              <div><strong>Expected Salary:</strong> ₹{form.expected_salary.toLocaleString("en-IN")}/mo</div>
              <div><strong>Availability:</strong> {form.availability || "—"}</div>
              <div><strong>Education:</strong> {form.highest_qualification || "—"}</div>
              <div><strong>Experience:</strong> {form.total_experience || "—"}</div>
              <div><strong>Skills:</strong> {form.skills.length ? form.skills.join(", ") : "—"}</div>
              <div><strong>Languages:</strong> {Object.keys(form.languages_known).join(", ") || "—"}</div>
              <div><strong>Emergency:</strong> {form.emergency_name ? `${form.emergency_name} (${form.emergency_relationship}) — ${form.emergency_phone}` : "—"}</div>
            </div>
            <label className="declaration">
              <input
                type="checkbox"
                checked={form.declaration_accepted}
                onChange={(e) => set("declaration_accepted", e.target.checked)}
              />
              <span>
                I certify that the information provided above is true and correct to the
                best of my knowledge. I understand that any false information may result
                in disqualification.
              </span>
            </label>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn" type="button" onClick={prev} disabled={step === 0 || busy}>
          ← Previous
        </button>
        {step < SECTIONS.length - 1 ? (
          <button className="btn primary" type="button" onClick={next} disabled={busy}>
            Next →
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={submit}
            disabled={busy || !form.declaration_accepted}
          >
            {busy ? "Saving…" : "Submit Registration"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ alignSelf: "center", fontSize: 11 }}>
          Draft auto-saved locally · You can close the browser and come back.
        </span>
        <button className="btn" type="button" onClick={() => navigate("/candidates")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
