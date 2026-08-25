import ClinicChat from '../components/ClinicChat';
import { DeskPage, DeskPanel, PageHeader } from '../components/PageChrome';

export default function AssistantPage() {
  return (
    <DeskPage>
      <PageHeader title="AI assistant" hint="Ask about queues, folders, and the next desk for a patient." />
      <DeskPanel className="mt-5">
        <ClinicChat />
      </DeskPanel>
    </DeskPage>
  );
}
