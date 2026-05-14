export function LoginPage({ email, password, message, setEmail, setPassword, onLogin }) {
  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={onLogin}>
        <h1>StreamBox</h1>
        <p>Manage uploads, encoding, playback links, and domain access.</p>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit">Sign in</button>
        {message && <span className="message">{message}</span>}
      </form>
    </main>
  );
}

