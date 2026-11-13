import ApprovalsList from "./ApprovalsList";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Client Requests</h1>
        <p className="text-sm text-slate-500">
          Changes your clients asked for in their portal. Approving applies the change to their chart immediately.
        </p>
      </div>
      <ApprovalsList />
    </div>
  );
}
