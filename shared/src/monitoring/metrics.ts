import client from "prom-client";
import type { FastifyInstance } from "fastify";

const register = client.register;

// runtime Node.js (RAM, CPU, Event Loop, etc.)
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  // Percentile
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export function setupMetrics(fastify: FastifyInstance, serviceName: string) {
  client.register.setDefaultLabels({
    service: serviceName,
  });

  fastify.addHook("onResponse", async (request, reply) => {
    if (request.url === "/metrics" || request.url === "/health") {
      return;
    }

    const route = request.routeOptions.url || request.url;
    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };

    // 1. Incrément du compteur de requêtes
    httpRequestCounter.inc(labels);

    // 2. Enregistrement de la durée dans l'histogramme (converti en secondes)
    const durationInSeconds = reply.elapsedTime / 1000;
    httpRequestDuration.observe(labels, durationInSeconds);
  });

  fastify.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
}
