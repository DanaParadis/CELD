
interface LoginPageProps {
  username: string
  password: string
  authError: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
}

function LoginPage({
  username,
  password,
  authError,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginPageProps) {
  return (
    <section className="workflow-section login-section">
      <div>
        <p className="eyebrow">CELD ACCOUNT</p>
        <h1>Sign in</h1>
        <p>Sign in to access your campus equipment reservations.</p>
      </div>

      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
        />

        {authError && (
          <p className="error-message" role="alert">
            {authError}
          </p>
        )}

        <button className="login-button" type="submit">
          Sign in
        </button>
      </form>
    </section>
  )
}

export default LoginPage
