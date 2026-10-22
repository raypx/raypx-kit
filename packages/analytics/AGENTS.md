# Analytics

Consent-controlled browser analytics backed by the external PostHog SDK. Root exports
are platform-neutral; browser and React imports must remain safe during SSR. Never
initialize on import or read environment variables. Applications own configuration,
event names, identity, allowed fields, preferences and error UI. Both consent categories
default off. SDK loading and delivery failures must not affect product operations.
No autocapture, replay, console, request payloads or raw error messages. Keep only
application asset frames in exceptions. React is an optional peer. Test public contracts,
including isolated consumers without React, and the real SDK's outgoing requests.
Use the SDK only for formatting: before_send hands sanitized events to a cancellable,
single-attempt fetch and returns null. Never feed SDK retry queues. Reconcile its
separate persisted consent after initialization; abort stale requests on lifecycle changes.
