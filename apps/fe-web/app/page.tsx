"use client";

import Link from "next/link";
import {
  Upload,
  Play,
  FileText,
  BarChart3,
  Zap,
  Shield,
  Users,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          QA Generation System
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          AI-powered QA generation using 8-Agent collaboration. Upload your
          documents, generate high-quality Q&A pairs, and evaluate them with
          comprehensive quality metrics.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/upload">
            <Button size="lg" className="px-8">
              <Upload className="mr-2 h-5 w-5" />
              Get Started
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="px-8">
              <BarChart3 className="mr-2 h-5 w-5" />
              View Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              8-Agent System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Meta-adaptive expert orchestration with specialized agents for
              different aspects of QA generation and quality control.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              Quality Assurance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Comprehensive quality metrics including duplication detection,
              evidence validation, and hallucination checks.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Multi-Format Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Support for text documents (.txt), rich text (.rtf), and existing
              QA pairs (.jsonl) for various input scenarios.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-500" />
              Expert-Level Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Target quality score of 9.5/10 with transparent reasoning and
              comprehensive audit trails for all decisions.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Simple 4-Step Process
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">1. Upload</h3>
            <p className="text-gray-600 text-sm">
              Upload your documents or existing QA pairs
            </p>
            <Link href="/upload">
              <Button variant="outline" size="sm" className="mt-3">
                Upload Files
              </Button>
            </Link>
          </div>

          {/* Step 2 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">2. Generate</h3>
            <p className="text-gray-600 text-sm">
              Run QA generation and quality evaluation
            </p>
            <Link href="/run">
              <Button variant="outline" size="sm" className="mt-3">
                Run Process
              </Button>
            </Link>
          </div>

          {/* Step 3 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">3. Review</h3>
            <p className="text-gray-600 text-sm">
              Review results and filter by quality metrics
            </p>
            <Link href="/results">
              <Button variant="outline" size="sm" className="mt-3">
                View Results
              </Button>
            </Link>
          </div>

          {/* Step 4 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">4. Analyze</h3>
            <p className="text-gray-600 text-sm">
              Analyze quality metrics and improvement areas
            </p>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="mt-3">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quality Metrics Preview */}
      <div className="bg-white rounded-lg border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Quality Metrics Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">5%</div>
            <div className="text-sm text-gray-600">Duplication Rate</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              Excellent
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">95%</div>
            <div className="text-sm text-gray-600">Evidence Quality</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              Excellent
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">2%</div>
            <div className="text-sm text-gray-600">Hallucination Rate</div>
            <Badge className="mt-1 bg-green-100 text-green-800">Safe</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">88%</div>
            <div className="text-sm text-gray-600">Coverage Score</div>
            <Badge className="mt-1 bg-blue-100 text-blue-800">Good</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">0</div>
            <div className="text-sm text-gray-600">PII Violations</div>
            <Badge className="mt-1 bg-green-100 text-green-800">Secure</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">87.5%</div>
            <div className="text-sm text-gray-600">Overall Score</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              Excellent
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
