import { Shield } from "lucide-react";

export function DomainsPage({ domain, ruleType, rules, setDomain, setRuleType, onAddRule, onDeleteRule }) {
  return (
    <div className="grid single">
      <section className="panel wide">
        <h3><Shield size={18} /> Domain Rules</h3>
        <form onSubmit={onAddRule} className="domain-form">
          <input placeholder="example.com" value={domain} onChange={(event) => setDomain(event.target.value)} />
          <select value={ruleType} onChange={(event) => setRuleType(event.target.value)}>
            <option value="allow">Allow</option>
            <option value="block">Block</option>
          </select>
          <button type="submit">Save Rule</button>
        </form>
        <div className="rules">
          {rules.map((rule) => (
            <span key={rule.id} className={`rule ${rule.rule_type}`}>
              {rule.rule_type}: {rule.domain}
              <button onClick={() => onDeleteRule(rule.id)}>x</button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

