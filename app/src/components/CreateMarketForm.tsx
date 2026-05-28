import { useState } from 'react';
import { config } from '../config';
import { createMarket, registerMarket } from '../studio';
import { parseTokenAmount } from '../dapp';
import { managerAccess } from '../operatorAccess';
import { ensureXLayer, type WalletState } from '../wallet';

export function CreateMarketForm({
  wallet,
  onCreated,
}: {
  wallet: WalletState;
  onCreated: () => Promise<void>;
}) {
  const [question, setQuestion] = useState('Will OKB trade above the demo target at deadline?');
  const [collateral, setCollateral] = useState<string>(config.collateralToken || '');
  const [resolver, setResolver] = useState<string>(config.resolverAddress || '');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [maxCollateral, setMaxCollateral] = useState('1000');
  const [autoRegister, setAutoRegister] = useState(true);
  const [status, setStatus] = useState('');
  const [createdMarket, setCreatedMarket] = useState<`0x${string}` | ''>('');
  const [step, setStep] = useState(0);
  const access = managerAccess(wallet.account);
  const steps = ['Basics', 'Parameters', 'Deadline', 'Review'];
  const onReviewStep = step === steps.length - 1;

  async function submit() {
    if (!wallet.provider || !access.allowed) return;
    setStatus('Creating market...');
    await ensureXLayer(wallet.provider);
    const created = await createMarket(
      wallet.provider,
      question,
      collateral as `0x${string}`,
      resolver as `0x${string}`,
      BigInt(Math.floor(new Date(deadline).getTime() / 1000)),
      parseTokenAmount(maxCollateral),
    );
    if (created.createdMarket) setCreatedMarket(created.createdMarket);
    setStatus(created.createdMarket ? `Created ${created.createdMarket}` : `Created in ${created.hash}`);

    if (autoRegister && created.createdMarket) {
      setStatus(`Registering ${created.createdMarket}...`);
      await registerMarket(wallet.provider, created.createdMarket);
      setStatus(`Created and registered ${created.createdMarket}`);
    }
    await onCreated();
  }

  async function registerCreated() {
    if (!wallet.provider || !createdMarket || !access.allowed) return;
    setStatus(`Registering ${createdMarket}...`);
    await ensureXLayer(wallet.provider);
    await registerMarket(wallet.provider, createdMarket);
    setStatus(`Registered ${createdMarket}`);
    await onCreated();
  }

  return (
    <form
      className="studio-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!onReviewStep) {
          setStep((current) => Math.min(current + 1, steps.length - 1));
          return;
        }
        void submit();
      }}
    >
      <div className="wizard-steps" aria-label="Create market steps">
        {steps.map((label, index) => (
          <button key={label} type="button" className={step === index ? 'active' : ''} onClick={() => setStep(index)}>
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && <label><span>Question</span><input value={question} onChange={(event) => setQuestion(event.target.value)} /></label>}
      {step === 1 && (
        <>
          <label><span>Collateral token</span><input value={collateral} onChange={(event) => setCollateral(event.target.value)} /></label>
          <label><span>Max collateral</span><input value={maxCollateral} onChange={(event) => setMaxCollateral(event.target.value)} /></label>
        </>
      )}
      {step === 2 && (
        <>
          <label><span>Resolver</span><input value={resolver} onChange={(event) => setResolver(event.target.value)} /></label>
          <label><span>Deadline</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
        </>
      )}
      {step === 3 && (
        <section className="review-panel">
          <dl>
            <dt>Question</dt><dd>{question}</dd>
            <dt>Collateral</dt><dd>{collateral}</dd>
            <dt>Resolver</dt><dd>{resolver}</dd>
            <dt>Deadline</dt><dd>{deadline}</dd>
            <dt>Max collateral</dt><dd>{maxCollateral} cUSDC</dd>
          </dl>
          <label className="inline-check"><input type="checkbox" checked={autoRegister} onChange={(event) => setAutoRegister(event.target.checked)} /> Register after create</label>
        </section>
      )}
      <p className={access.allowed ? 'muted' : 'tx-status error'}>{access.reason}</p>
      <div className="studio-actions">
        <button className="secondary-cta" type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>Back</button>
        <button className="primary-cta" type="submit" disabled={onReviewStep && (!wallet.provider || !access.allowed)}>
          {onReviewStep ? 'Create market' : 'Next'}
        </button>
      </div>
      {createdMarket && <button className="secondary-cta" type="button" onClick={registerCreated} disabled={!access.allowed}>Register created market</button>}
      {status && <p className="tx-status">{status}</p>}
    </form>
  );
}
