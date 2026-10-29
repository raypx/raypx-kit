/** Job/agent and shell identifiers do not affect repository outputs. Keep them out of Vite's env report. */
export function taskEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) =>
        !/^(?:CODEX_|GITHUB_(?!ACTIONS$)|RUNNER_|ACTIONS_|OTEL_|TRACEPARENT$|TRACESTATE$|SHLVL$|_$|OLDPWD$|TERM_SESSION_ID$|XPC_|__CF|SECURITYSESSIONID$|LaunchInstanceID$|npm_(?:lifecycle_|package_|command$|execpath$|node_execpath$|config_user_agent$))/.test(
          name,
        ),
    ),
  );
}
