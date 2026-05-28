export type DemoJourneyStep = {
  id: string;
  label: string;
  detail: string;
  status: 'done' | 'active' | 'locked';
};

export function DemoJourneyStepper({ steps }: { steps: DemoJourneyStep[] }) {
  return (
    <ol className="demo-stepper">
      {steps.map((step, index) => (
        <li key={step.id} className={step.status}>
          <span>{step.status === 'done' ? '✓' : index + 1}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
