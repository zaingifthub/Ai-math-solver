import { HistoryList } from "@/components/dashboard/history-list";

export default function HistoryPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Solution history</h1>
      <HistoryList />
    </div>
  );
}
