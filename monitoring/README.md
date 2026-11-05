# Monitoring Stack (Prometheus & Grafana)

This module provides complete infrastructure and application observability for all **ft_transcendence** microservices (`auth`, `chat`, `game`, `user`).

---

## Architecture Overview

The monitoring pipeline follows a **pull-based scraping** pattern provisioned declaratively via **Infrastructure as Code (IaC)**:

[ Fastify Microservices ]  ──(internal network: /metrics)──>  [ Prometheus:9090 ]  ──>  [ Grafana:3000 ]
(auth, chat, game, user)                                     (scrapes every 5s)       (Auto-provisioned)


* **Network Isolation & Security:** Microservice `/metrics` endpoints are strictly bound to the internal Docker network. Prometheus scrapes containers directly via internal Docker DNS (`auth:3001`, `chat:3003`, etc.). No metrics endpoint is exposed through the public Nginx gateway.
* **Zero-Configuration Provisioning:** Grafana automatically provisions both the Prometheus datasource and the `Transcendence - Mission Control` dashboard on startup without requiring manual UI configuration.

---

## Collected Metrics (The 4 Golden Signals)

Instrumentation is centralized in `shared/src/monitoring/metrics.ts` using `prom-client`:

| Signal | Metric Name | Type | Description |
| :--- | :--- | :--- | :--- |
| **Health** | `up` | Gauge | Binary reachability status per service (`1` = UP, `0` = DOWN). |
| **Latency** | `http_request_duration_seconds` | Histogram | Computes **p95** and **p99** percentiles to expose edge-case delays. |
| **Traffic** | `http_requests_total` | Counter | Global request throughput measured in requests per second (RPS). |
| **Errors** | `http_requests_total{status_code=~"[45].."}` | Counter | Error rate percentage, client failures (4xx), and server crashes (5xx). |
| **Saturation** | `process_cpu_seconds_total` & `nodejs_heap_size_used_bytes` | Counter / Gauge | CPU core consumption and active Node.js V8 heap memory usage. |

> **Why use Histograms over Averages for Latency?**  
> A simple arithmetic mean hides performance degradations (*outliers*): 99 fast requests at 2 ms and 1 stuck query at 2,000 ms yield an average of ~22 ms, falsely masking a critical bottleneck. Histograms bucket execution times, allowing `histogram_quantile()` to reliably surface what the slowest 5% (p95) and 1% (p99) of users experience.

---

## Repository Structure

```text
monitoring/
├── README.md
├── prometheus/
│   └── prometheus.yml          # Scrape targets and intervals
└── grafana/
    ├── provisioning/
    │   ├── datasources/        # Automatic Prometheus connection config
    │   └── dashboards/         # Dashboard provider definition
    └── monitoring.json         # Dashboard definition (panels, grid layout, PromQL queries)

Evaluation & Live Demo Guide
1. Launch the Stack
Bash

docker compose up -d --build

Access Grafana at http://localhost:3000 (default credentials: admin / admin).
2. Service Outage & Recovery Demo

Simulate an unexpected container crash:
Bash

docker compose stop chat

Within two scrape intervals (≤10 seconds), the Service Status indicator for chat-service changes from green (UP) to red (DOWN).

Restore the container:
Bash

docker compose start chat

3. Traffic Generation & Error Handling Demo

Send concurrent synthetic requests generating 404 responses to verify that RPS counters, error percentages, and latency percentiles update in real time:
Bash

for i in {1..40}; do
  docker compose exec -T auth wget -q -O /dev/null "http://auth:3001/api/auth/probe-$RANDOM"
  sleep 0.1
done


<FollowUp label="Would you like to add a PromQL reference section listing the exact queri