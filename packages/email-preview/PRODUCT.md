# Email Preview

## Users and purpose

Developers composing React Email templates need to compare layouts, inspect the
generated HTML or plain text, and see the effect of a saved change without leaving
their local workflow. The application runs in the project's Vite dev server and reads
templates from the developer's project.

## Experience

Use an English developer interface with a compact template sidebar, clear active
selection and a large email canvas. Search, template navigation and output actions
remain visible without competing with the email content. Desktop and mobile width
controls inspect the same rendered output.

Keep the interface neutral and precise, with readable typography and restrained
color. The template is the visual focus. Loading, empty directories, missing
selections and rendering errors should explain what happened and the next useful
action. A source edit should recover a failed preview without restarting the app.

## Accessibility

Use semantic buttons and navigation, visible keyboard focus, labeled controls,
and readable code output. Copy actions report completion. The sidebar adapts to
small windows, while source views can scroll without widening the whole page.
Respect reduced-motion preferences and preserve sufficient color contrast.

## Boundaries

This is a local preview tool. It offers template discovery, live updates, desktop
and mobile views, and HTML/text copy and download. It has no sending credentials,
delivery workflow, production hosting or simulated email-client compatibility.
