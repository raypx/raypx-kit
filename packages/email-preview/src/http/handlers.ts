import "@tanstack/react-start/server-only";
import { PreviewRuntimeError } from "../server/errors.js";
import { getPreviewRuntime } from "../server/runtime.js";

const noCache = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const streams = new Set<() => void>();

export function closeEventStreams() {
  for (const close of streams) close();
}

function failure(error: unknown) {
  const expected = error instanceof PreviewRuntimeError;
  return Response.json(
    {
      error: {
        code: expected ? error.code : "INTERNAL_ERROR",
        message: expected
          ? error.message
          : "The preview request failed. Try again after checking the template.",
      },
    },
    { status: expected ? error.status : 500, headers: noCache },
  );
}

export async function templatesResponse() {
  try {
    return Response.json(await getPreviewRuntime().listTemplates(), { headers: noCache });
  } catch (error) {
    return failure(error);
  }
}

export async function previewResponse(request: Request) {
  try {
    const template = new URL(request.url).searchParams.get("template");
    if (!template)
      throw new PreviewRuntimeError("INVALID_TEMPLATE", "Select an email template.", 400);
    return Response.json(await getPreviewRuntime().renderTemplate(template), { headers: noCache });
  } catch (error) {
    return failure(error);
  }
}

export async function staticResponse(path: string) {
  try {
    const file = await getPreviewRuntime().getStaticFile(path);
    return new Response(Uint8Array.from(file.data), {
      headers: {
        ...noCache,
        "Content-Type": file.contentType,
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export function eventsResponse(request: Request) {
  try {
    const runtime = getPreviewRuntime();
    const encoder = new TextEncoder();
    let close = () => {};
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const send = (event: string, revision: number) => {
          if (!closed)
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ revision })}\n\n`),
            );
        };
        const unsubscribe = runtime.subscribe((revision) => send("change", revision));
        const heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 15000);
        heartbeat.unref();
        close = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          streams.delete(close);
          request.signal.removeEventListener("abort", close);
          if (!cancelled) controller.close();
        };
        streams.add(close);
        request.signal.addEventListener("abort", close, { once: true });
        send("ready", runtime.revision);
        if (request.signal.aborted) close();
      },
      cancel() {
        cancelled = true;
        close();
      },
    });
    return new Response(stream, {
      headers: {
        ...noCache,
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
