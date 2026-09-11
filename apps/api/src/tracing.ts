// Imported as the very first thing in index.ts (after config/env, which has
// no bearing on instrumentation) — OpenTelemetry's auto-instrumentation
// patches modules like express/mongoose at require-time, so this file's
// NodeSDK.start() must run before app.ts (or anything it imports) pulls
// those modules in, or the patch never takes effect.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from './config/env';

// Off by default — tracing requires a collector to send spans to (Jaeger, an
// OTel Collector, etc.), which isn't part of this project's default local
// setup. Setting OTEL_EXPORTER_OTLP_ENDPOINT opts in; nothing else changes.
if (OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME }),
    traceExporter: new OTLPTraceExporter({ url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new MongooseInstrumentation(),
    ],
  });
  sdk.start();

  const shutdown = () => { sdk.shutdown().catch(() => {}); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // eslint-disable-next-line no-console -- logger.ts isn't safe to import
  // this early (before instrumentation is installed); this is startup-only.
  console.log(`[tracing] OpenTelemetry enabled, exporting to ${OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
