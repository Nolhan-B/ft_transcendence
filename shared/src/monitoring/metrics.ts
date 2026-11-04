import client from "prom-client";
import type { FastifyInstance } from "fastify";

const register = client.register;

// runtime Node.js (RAM, CPU, Event Loop, etc.)
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP request",
  labelNames: ["method", "route", "status_code"],
});

export function setupMetrics(fastify: FastifyInstance, serviceName: string) {
  client.register.setDefaultLabels({
    service: serviceName,
  });

  fastify.addHook("onResponse", async (request, reply) => {
    if (request.url === "/metrics" || request.url === "/health") {
      return;
    }

    httpRequestCounter.inc({
      method: request.method,
      route: request.routeOptions.url || request.url,
      status_code: reply.statusCode.toString(),
    });
  });

  fastify.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });
}
