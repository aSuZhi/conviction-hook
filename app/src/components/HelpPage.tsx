export function HelpPage() {
  return (
    <section className="page-stack readable-page">
      <h1>How Conviction works</h1>
      <p>Conviction is a Hook-native event asset protocol. Users enter YES or NO exposure through the Router path, and each swap lets the Hook update market state.</p>
      <h2>Why exact approvals?</h2>
      <p>The DApp approves only the amount needed for the current action. Unlimited allowances are not part of the trading flow.</p>
      <h2>How settlement works</h2>
      <p>After resolution, winners claim from the shared collateral pool according to winning conviction weight.</p>
    </section>
  );
}
