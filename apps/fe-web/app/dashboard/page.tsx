"use client"

import { useState, useEffect } from "react"
import { BarChart, PieChart, TrendingUp, AlertTriangle, CheckCircle, Shield, Clock, DollarSign, Target, Users, Activity } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

interface QualityMetrics {
  overall_score: number
  recommendation_level: 'green' | 'yellow' | 'red'
  total_alerts: number
  metric_scores: {
    duplication_rate: number
    evidence_presence_rate: number
    hallucination_rate: number
    pii_violations: number
    coverage_score: number
    inference_type_ratio?: number
  }
  threshold_validation: {
    enabled: boolean
    gate_status: 'PASS' | 'WARN' | 'FAIL'
    can_proceed: boolean
    p0_violations: string[]
    p1_warnings: string[]
    p2_issues: string[]
  }
}

interface ABTestResult {
  variantId: string
  variantName: string
  sampleSize: number
  avgQualityScore: number
  avgProcessingTime: number
  avgConfidence: number
  successRate: number
  totalCost: number
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null)
  const [abTestResults, setAbTestResults] = useState<ABTestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [selectedTab, setSelectedTab] = useState('quality')

  useEffect(() => {
    fetchReport()
    fetchABTestResults()
  }, [])

  const fetchReport = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || '/api'
      const response = await fetch(`${apiBase}/report`)

      if (response.ok) {
        const data = await response.json()
        setMetrics(data.quality_metrics || data)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to fetch report')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const fetchABTestResults = async () => {
    try {
      // Mock data for A/B test results
      const mockResults: ABTestResult[] = [
        {
          variantId: 'conservative',
          variantName: 'Conservative Approach',
          sampleSize: 45,
          avgQualityScore: 7.2,
          avgProcessingTime: 850,
          avgConfidence: 0.82,
          successRate: 0.96,
          totalCost: 0.34
        },
        {
          variantId: 'balanced',
          variantName: 'Balanced Approach',
          sampleSize: 48,
          avgQualityScore: 8.1,
          avgProcessingTime: 1250,
          avgConfidence: 0.87,
          successRate: 0.94,
          totalCost: 0.89
        },
        {
          variantId: 'comprehensive',
          variantName: 'Comprehensive Approach',
          sampleSize: 42,
          avgQualityScore: 8.9,
          avgProcessingTime: 2100,
          avgConfidence: 0.92,
          successRate: 0.90,
          totalCost: 1.76
        },
        {
          variantId: 'specialist',
          variantName: 'Specialist Focused',
          sampleSize: 38,
          avgQualityScore: 8.4,
          avgProcessingTime: 1680,
          avgConfidence: 0.89,
          successRate: 0.92,
          totalCost: 1.23
        }
      ]
      setAbTestResults(mockResults)
    } catch (err) {
      console.error('Failed to fetch A/B test results:', err)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return "text-green-600"
    if (score >= 0.70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBg = (score: number) => {
    if (score >= 0.85) return "bg-green-100"
    if (score >= 0.70) return "bg-yellow-100"
    return "bg-red-100"
  }

  const getRecommendationBadge = (level: string) => {
    switch (level) {
      case 'green':
        return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
      case 'yellow':
        return <Badge className="bg-yellow-100 text-yellow-800">Review Needed</Badge>
      case 'red':
        return <Badge variant="destructive">Action Required</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getGateStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'WARN':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'FAIL':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Shield className="w-5 h-5 text-gray-500" />
    }
  }

  const getBestVariant = () => {
    if (abTestResults.length === 0) return null
    return abTestResults.reduce((best, current) =>
      current.avgQualityScore > best.avgQualityScore ? current : best
    )
  }

  const getFastestVariant = () => {
    if (abTestResults.length === 0) return null
    return abTestResults.reduce((fastest, current) =>
      current.avgProcessingTime < fastest.avgProcessingTime ? current : fastest
    )
  }

  const getMostCostEfficient = () => {
    if (abTestResults.length === 0) return null
    return abTestResults.reduce((efficient, current) => {
      const currentRatio = current.avgQualityScore / current.totalCost
      const efficientRatio = efficient.avgQualityScore / efficient.totalCost
      return currentRatio > efficientRatio ? current : efficient
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-800">Error loading dashboard</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No quality metrics available</p>
            <p className="text-sm text-gray-500 mt-2">
              Run QA generation and evaluation first to see quality metrics
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance Dashboard</h1>
        <p className="text-gray-600">
          Monitor quality metrics, A/B test results, and system performance
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="quality">
          {renderQualityDashboard()}
        </TabsContent>

        <TabsContent value="abtests">
          {renderABTestDashboard()}
        </TabsContent>

        <TabsContent value="performance">
          {renderPerformanceDashboard()}
        </TabsContent>
      </Tabs>
    </div>
  )

  function renderQualityDashboard() {
    if (!metrics) {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No quality metrics available</p>
            <p className="text-sm text-gray-500 mt-2">
              Run QA generation and evaluation first to see quality metrics
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-8">

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Overall Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${getScoreColor(metrics.overall_score)}`}>
                {(metrics.overall_score * 100).toFixed(1)}%
              </div>
              <div className="mb-3">
                {getRecommendationBadge(metrics.recommendation_level)}
              </div>
              <Progress
                value={metrics.overall_score * 100}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gate Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                {getGateStatusIcon(metrics.threshold_validation.gate_status)}
                <span className="text-xl font-semibold">
                  {metrics.threshold_validation.gate_status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {metrics.threshold_validation.can_proceed
                  ? "System can proceed to production"
                  : "Review required before proceeding"}
              </p>
              <Badge variant={metrics.threshold_validation.can_proceed ? "default" : "destructive"}>
                {metrics.threshold_validation.can_proceed ? "Ready" : "Blocked"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${
                metrics.total_alerts === 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metrics.total_alerts}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {metrics.total_alerts === 0 ? "No issues detected" : "Issues requiring attention"}
              </p>
              <div className="space-y-1">
                {metrics.threshold_validation.p0_violations.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {metrics.threshold_validation.p0_violations.length} Critical
                  </Badge>
                )}
                {metrics.threshold_validation.p1_warnings.length > 0 && (
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                    {metrics.threshold_validation.p1_warnings.length} Warnings
                  </Badge>
                )}
                {metrics.threshold_validation.p2_issues.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {metrics.threshold_validation.p2_issues.length} Minor
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Duplication Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Content Duplication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duplication Rate</span>
                <span className={`font-semibold ${
                  metrics.metric_scores.duplication_rate <= 0.15 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(metrics.metric_scores.duplication_rate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={metrics.metric_scores.duplication_rate * 100}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Target: &lt;15% • {metrics.metric_scores.duplication_rate <= 0.15 ? '✅ Good' : '⚠️ High'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Evidence Quality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidence Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Evidence Presence</span>
                <span className={`font-semibold ${
                  metrics.metric_scores.evidence_presence_rate >= 0.80 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(metrics.metric_scores.evidence_presence_rate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={metrics.metric_scores.evidence_presence_rate * 100}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Target: &gt;80% • {metrics.metric_scores.evidence_presence_rate >= 0.80 ? '✅ Good' : '⚠️ Low'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hallucination Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hallucination Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Hallucination Rate</span>
                <span className={`font-semibold ${
                  metrics.metric_scores.hallucination_rate <= 0.05 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(metrics.metric_scores.hallucination_rate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={metrics.metric_scores.hallucination_rate * 100}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Target: &lt;5% • {metrics.metric_scores.hallucination_rate <= 0.05 ? '✅ Safe' : '⚠️ High'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Content Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Coverage Score</span>
                <span className={`font-semibold ${
                  metrics.metric_scores.coverage_score >= 0.80 ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {(metrics.metric_scores.coverage_score * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={metrics.metric_scores.coverage_score * 100}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Target: &gt;80% • {metrics.metric_scores.coverage_score >= 0.80 ? '✅ Complete' : '⚠️ Gaps'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PII Violations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Privacy Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">PII Violations</span>
                <span className={`font-semibold ${
                  metrics.metric_scores.pii_violations === 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.metric_scores.pii_violations}
                </span>
              </div>
              <div className={`p-3 rounded-md ${
                metrics.metric_scores.pii_violations === 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <p className="text-sm font-medium">
                  {metrics.metric_scores.pii_violations === 0 ? '✅ Compliant' : '❌ Violations Found'}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Target: 0 violations • {metrics.metric_scores.pii_violations === 0 ? 'Secure' : 'Review Required'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Question Type Balance */}
        {metrics.metric_scores.inference_type_ratio && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Type Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Inference Questions</span>
                  <span className={`font-semibold ${
                    metrics.metric_scores.inference_type_ratio >= 0.10 ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {(metrics.metric_scores.inference_type_ratio * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={metrics.metric_scores.inference_type_ratio * 100}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Target: &gt;10% • {metrics.metric_scores.inference_type_ratio >= 0.10 ? '✅ Balanced' : '⚠️ Limited'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Issues and Recommendations */}
      {(metrics.threshold_validation.p0_violations.length > 0 ||
        metrics.threshold_validation.p1_warnings.length > 0 ||
        metrics.threshold_validation.p2_issues.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Issues & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Critical Issues */}
              {metrics.threshold_validation.p0_violations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Critical Issues (P0)</h4>
                  <ul className="space-y-1">
                    {metrics.threshold_validation.p0_violations.map((issue, idx) => (
                      <li key={idx} className="text-sm text-red-600 flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {metrics.threshold_validation.p1_warnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-700 mb-2">Warnings (P1)</h4>
                  <ul className="space-y-1">
                    {metrics.threshold_validation.p1_warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-600 flex items-center gap-2">
                        <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Minor Issues */}
              {metrics.threshold_validation.p2_issues.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Minor Issues (P2)</h4>
                  <ul className="space-y-1">
                    {metrics.threshold_validation.p2_issues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    )
  }

  function renderABTestDashboard() {
    return (
      <div className="space-y-6">
        {/* A/B Test KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Best Quality</p>
                  <p className="text-2xl font-bold text-green-600">
                    {getBestVariant()?.avgQualityScore.toFixed(1) || '0.0'}
                  </p>
                  <p className="text-xs text-gray-500">{getBestVariant()?.variantName}</p>
                </div>
                <Target className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fastest</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {getFastestVariant()?.avgProcessingTime || 0}ms
                  </p>
                  <p className="text-xs text-gray-500">{getFastestVariant()?.variantName}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cost Efficient</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${getMostCostEfficient()?.totalCost.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-500">{getMostCostEfficient()?.variantName}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tests</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {abTestResults.reduce((sum, r) => sum + r.sampleSize, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Across all variants</p>
                </div>
                <Activity className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* A/B Test Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>A/B Test Results Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Variant</th>
                    <th className="text-left p-3">Sample Size</th>
                    <th className="text-left p-3">Quality Score</th>
                    <th className="text-left p-3">Processing Time</th>
                    <th className="text-left p-3">Confidence</th>
                    <th className="text-left p-3">Success Rate</th>
                    <th className="text-left p-3">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {abTestResults.map((result) => (
                    <tr key={result.variantId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{result.variantName}</p>
                          <p className="text-xs text-gray-500">{result.variantId}</p>
                        </div>
                      </td>
                      <td className="p-3">{result.sampleSize}</td>
                      <td className="p-3">
                        <Badge variant={result.avgQualityScore >= 8.5 ? 'default' : result.avgQualityScore >= 7.5 ? 'secondary' : 'destructive'}>
                          {result.avgQualityScore.toFixed(1)}/10
                        </Badge>
                      </td>
                      <td className="p-3">{result.avgProcessingTime}ms</td>
                      <td className="p-3">{(result.avgConfidence * 100).toFixed(1)}%</td>
                      <td className="p-3">{(result.successRate * 100).toFixed(1)}%</td>
                      <td className="p-3">${result.totalCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">🏆 Best Overall Performance</p>
                <p className="text-green-700">
                  <strong>{getBestVariant()?.variantName}</strong> shows the highest quality scores
                  with {getBestVariant()?.avgQualityScore.toFixed(1)}/10 average rating.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 font-medium">⚡ Speed Champion</p>
                <p className="text-blue-700">
                  For time-critical applications, consider <strong>{getFastestVariant()?.variantName}</strong>
                  with {getFastestVariant()?.avgProcessingTime}ms average processing time.
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-purple-800 font-medium">💰 Cost Efficient</p>
                <p className="text-purple-700">
                  <strong>{getMostCostEfficient()?.variantName}</strong> offers the best quality-to-cost ratio
                  at ${getMostCostEfficient()?.totalCost.toFixed(2)} total cost.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  function renderPerformanceDashboard() {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Performance trends coming soon</p>
          <p className="text-sm text-gray-500 mt-2">
            Real-time performance monitoring will be available here
          </p>
        </CardContent>
      </Card>
    )
  }
}