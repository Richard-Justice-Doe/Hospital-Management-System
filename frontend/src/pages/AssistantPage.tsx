import ClinicChat from '../components/ClinicChat';

export default function AssistantPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-clinic-900">AI assistant</h1>
      <section className="mt-6 rounded-xl border bg-white p-5">
        <ClinicChat />
      </section>
    </div>
  );
}
