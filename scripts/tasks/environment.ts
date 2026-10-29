const orchestration =
  /^(?:CODEX_|GITHUB_(?!ACTIONS$)|RUNNER_|ACTIONS_|OTEL_|TRACEPARENT$|TRACESTATE$)/;
const session =
  /^(?:SHLVL$|_$|OLDPWD$|TERM_SESSION_ID$|XPC_|__CF|SECURITYSESSIONID$|LaunchInstanceID$|INVOCATION_ID$|JOURNAL_STREAM$|SYSTEMD_|DBUS_|NOTIFY_SOCKET$|MEMORY_PRESSURE_)/;
const lifecycle =
  /^npm_(?:lifecycle_|package_|command$|execpath$|node_execpath$|config_user_agent$)/;

/** Operational identifiers cannot change repository outputs; Vite must not fingerprint them. */
export function taskEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) => ![orchestration, session, lifecycle].some((pattern) => pattern.test(name)),
    ),
  );
}
