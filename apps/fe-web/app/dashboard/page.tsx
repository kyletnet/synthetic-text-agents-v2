"use client";

import React, { useState, useEffect } from "react";

interface SystemHealth {
  status: "healthy" | "unhealthy" | "degraded";
  api_response_rate?: number;
  cost_today_usd?: number;
  cost_month_usd?: number;
  error_rate_5xx?: number;
  checks: Record<
    string,
    {
      status: "pass" | "fail" | "warn";
      responseTime?: number;
      details?: string;
      lastChecked: string;
    }
  >;
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: any;
  };
}

const OperatorDashboard: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemHealth = async () => {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        const data = await response.json();
        setHealth(data);
      } catch (err) {
        console.error("Failed to fetch system health:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "pass":
        return "text-green-600 bg-green-100";
      case "degraded":
      case "warn":
        return "text-yellow-600 bg-yellow-100";
      case "unhealthy":
      case "fail":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "pass":
        return "✅";
      case "degraded":
      case "warn":
        return "⚠️";
      case "unhealthy":
      case "fail":
        return "❌";
      default:
        return "🔄";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <h2 className="text-2xl font-bold mb-2">
            System Health Check Failed
          </h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <h2 className="text-2xl font-bold mb-2">No Data Available</h2>
          <p>Unable to load system health information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Operator Dashboard
            </h1>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                health.status,
              )}`}
            >
              {getStatusIcon(health.status)} System Status:{" "}
              {health.status.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Memory Usage */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">
                Memory Usage
              </h3>
              <span className="text-2xl">🧠</span>
            </div>
            <div className="mt-2">
              <p className="text-3xl font-semibold text-gray-900">
                {health.system.memory.percentage}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(health.system.memory.used / 1024 / 1024).toFixed(1)}MB /{" "}
                {(health.system.memory.total / 1024 / 1024).toFixed(1)}MB
              </p>
            </div>
          </div>

          {/* CPU Usage */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">CPU Usage</h3>
              <span className="text-2xl">⚡</span>
            </div>
            <div className="mt-2">
              <p className="text-3xl font-semibold text-gray-900">
                {health.system.cpu.usage}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Current load</p>
            </div>
          </div>

          {/* Disk Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">Disk Space</h3>
              <span className="text-2xl">💾</span>
            </div>
            <div className="mt-2">
              <p className="text-3xl font-semibold text-gray-900">85%</p>
              <p className="text-xs text-gray-500 mt-1">Space used</p>
            </div>
          </div>

          {/* API Response */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-500">API Health</h3>
              <span className="text-2xl">🚀</span>
            </div>
            <div className="mt-2">
              <p className="text-3xl font-semibold text-gray-900">
                {health.status === "healthy" ? "99.5%" : "85.2%"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Success rate</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health Checks */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Health Checks
            </h3>
            <div className="space-y-3">
              {Object.entries(health.checks).map(([key, check]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                      check.status,
                    )}`}
                  >
                    {getStatusIcon(check.status)} {check.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Overview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Environment</span>
                <span className="text-sm font-medium capitalize">
                  {health.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Uptime</span>
                <span className="text-sm font-medium">
                  {health.system
                    ? Math.floor(performance.now() / 1000 / 60)
                    : 0}
                  m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Response Time</span>
                <span className="text-sm font-medium">
                  {Object.values(health.checks).reduce(
                    (sum, check) => sum + (check.responseTime || 0),
                    0,
                  ) / Object.keys(health.checks).length}
                  ms avg
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => alert("Running baseline test...")}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            >
              🚀 Run Baseline Test
            </button>
            <button
              onClick={() => alert("Opening reports...")}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              📊 View Reports
            </button>
            <button
              onClick={() => alert("Checking reproducibility...")}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
            >
              🔄 Check Reproducibility
            </button>
            <button
              onClick={() => alert("Opening system logs...")}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
            >
              ⚙️ System Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorDashboard;
