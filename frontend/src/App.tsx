import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Candidates from "./pages/Candidates";
import CandidateForm from "./pages/CandidateForm";
import CandidateDetail from "./pages/CandidateDetail";
import Jobs from "./pages/Jobs";
import JobForm from "./pages/JobForm";
import JobDetail from "./pages/JobDetail";
import Approvals from "./pages/Approvals";
import Employers from "./pages/Employers";
import Institutions from "./pages/Institutions";
import Leads from "./pages/Leads";
import Pipeline from "./pages/Pipeline";
import ScreenResources from "./pages/ScreenResources";
import Kyc from "./pages/Kyc";
import FieldCheckin from "./pages/FieldCheckin";
import Locations from "./pages/Locations";
import RegistrationDrives from "./pages/RegistrationDrives";
import PiiViewLog from "./pages/PiiViewLog";
import Users from "./pages/admin/Users";
import Screening from "./pages/admin/Screening";
import Stages from "./pages/admin/Stages";
import Audit from "./pages/admin/Audit";
import StudentCentral from "./pages/admin/StudentCentral";
import EmailAccounts from "./pages/admin/EmailAccounts";
import EmailTemplates from "./pages/admin/EmailTemplates";
import EmailRules from "./pages/admin/EmailRules";
import PublicSharing from "./pages/admin/PublicSharing";
import Mailbox from "./pages/Mailbox";
import ReportsList from "./pages/reports/ReportsList";
import ReportBuilder from "./pages/reports/ReportBuilder";
import ReportViewer from "./pages/reports/ReportViewer";
import PublicApply from "./pages/PublicApply";
import PublicDriveApply from "./pages/PublicDriveApply";
import InstitutionDashboard from "./pages/institution/InstitutionDashboard";
import InstitutionUpload from "./pages/institution/InstitutionUpload";
import InstitutionCandidates from "./pages/institution/InstitutionCandidates";
import InstitutionCandidateForm from "./pages/institution/InstitutionCandidateForm";
import InstitutionUploadLogs from "./pages/institution/InstitutionUploadLogs";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/apply/:slug" element={<PublicApply />} />
      <Route path="/careers/:slug" element={<PublicApply />} />
      <Route path="/register/:slug" element={<PublicDriveApply />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/candidates/new" element={<CandidateForm />} />
        <Route path="/candidates/:id" element={<CandidateDetail />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/new" element={<JobForm />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/assignments" element={<Pipeline mineOnly />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/screen-resources" element={<ScreenResources />} />
        <Route path="/kyc" element={<Kyc />} />
        <Route path="/field/checkin" element={<FieldCheckin />} />
        <Route path="/field/locations" element={<Locations />} />
        <Route path="/field/drives" element={<RegistrationDrives />} />
        <Route path="/pii-log" element={<PiiViewLog />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/employers" element={<Employers />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/screening" element={<Screening />} />
        <Route path="/admin/stages" element={<Stages />} />
        <Route path="/admin/student-central" element={<StudentCentral />} />
        <Route path="/admin/audit" element={<Audit />} />
        <Route path="/admin/email/accounts" element={<EmailAccounts />} />
        <Route path="/admin/email/templates" element={<EmailTemplates />} />
        <Route path="/admin/email/rules" element={<EmailRules />} />
        <Route path="/admin/public-sharing" element={<PublicSharing />} />
        <Route path="/mailbox" element={<Mailbox />} />
        <Route path="/reports" element={<ReportsList />} />
        <Route path="/reports/new" element={<ReportBuilder />} />
        <Route path="/reports/:id" element={<ReportViewer />} />
        <Route path="/reports/:id/edit" element={<ReportBuilder />} />
        <Route path="/institution" element={<InstitutionDashboard />} />
        <Route path="/institution/upload" element={<InstitutionUpload />} />
        <Route path="/institution/candidates" element={<InstitutionCandidates />} />
        <Route path="/institution/candidates/new" element={<InstitutionCandidateForm />} />
        <Route path="/institution/uploads" element={<InstitutionUploadLogs />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
