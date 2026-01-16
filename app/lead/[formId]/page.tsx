import { LeadCaptureForm } from '@/components/leads/LeadCaptureForm';

export default function LeadFormPage({
  params,
}: {
  params: { formId: string };
}) {
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 flex items-center justify-center p-4'>
      <LeadCaptureForm formId={params.formId} />
    </div>
  );
}
