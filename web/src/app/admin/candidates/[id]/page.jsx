import { StaffShell } from '../../../components/staff-shell';
import { CandidateWorkspace } from '../../../../features/admin/candidates/components/CandidateWorkspace';

export default function CandidateDetailsPage({ params }) {
  return <StaffShell><CandidateWorkspace key={params.id} candidateId={params.id} /></StaffShell>;
}
