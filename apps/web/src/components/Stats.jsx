export function Stats({ stats }) {
  return (
    <section className="stats">
      <div><strong>{stats.total}</strong><span>Total</span></div>
      <div><strong>{stats.ready}</strong><span>Ready</span></div>
      <div><strong>{stats.processing}</strong><span>Processing</span></div>
      <div><strong>{stats.failed}</strong><span>Failed</span></div>
    </section>
  );
}

