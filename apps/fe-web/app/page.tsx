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
          스마트 QA 생성 시스템
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          8-Agent 협업 기반 AI 자동 QA 생성 시스템입니다. 문서를 업로드하고,
          고품질 Q&A 쌍을 생성하여, 종합적인 품질 메트릭으로 평가할 수 있습니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/smart-augment">
            <Button size="lg" className="px-8">
              <Upload className="mr-2 h-5 w-5" />
              지금 시작하기
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="px-8">
              <BarChart3 className="mr-2 h-5 w-5" />
              대시보드 보기
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
              8-Agent 시스템
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              QA 생성과 품질 관리의 다양한 측면을 담당하는 전문화된 에이전트들을
              메타 적응형으로 오케스트레이션하는 시스템입니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              품질 보장
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              중복 감지, 증거 검증, 환각 확인을 포함한 종합적인 품질 메트릭으로
              QA의 품질을 철저하게 관리합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              다양한 형식 지원
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              텍스트 문서(.txt), 리치 텍스트(.rtf), 기존 QA 쌍(.jsonl) 등
              다양한 입력 시나리오를 지원합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-500" />
              전문가 수준 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              9.5/10 목표 품질 점수로 투명한 추론과 모든 결정에 대한
              포괄적인 감사 기록을 제공합니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          간단한 4단계 프로세스
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">1. 업로드</h3>
            <p className="text-gray-600 text-sm">
              문서나 기존 QA 쌍을 업로드합니다
            </p>
            <Link href="/smart-augment">
              <Button variant="outline" size="sm" className="mt-3">
                파일 업로드
              </Button>
            </Link>
          </div>

          {/* Step 2 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">2. 생성</h3>
            <p className="text-gray-600 text-sm">
              QA 생성 및 품질 평가를 실행합니다
            </p>
            <Link href="/smart-augment">
              <Button variant="outline" size="sm" className="mt-3">
                자동 증강 실행
              </Button>
            </Link>
          </div>

          {/* Step 3 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">3. 검토</h3>
            <p className="text-gray-600 text-sm">
              결과를 검토하고 품질 메트릭으로 필터링합니다
            </p>
            <Link href="/results">
              <Button variant="outline" size="sm" className="mt-3">
                결과 보기
              </Button>
            </Link>
          </div>

          {/* Step 4 */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">4. 분석</h3>
            <p className="text-gray-600 text-sm">
              품질 메트릭과 개선 영역을 분석합니다
            </p>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="mt-3">
                대시보드 보기
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quality Metrics Preview */}
      <div className="bg-white rounded-lg border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          품질 메트릭 개요
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">5%</div>
            <div className="text-sm text-gray-600">중복률</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              우수
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">95%</div>
            <div className="text-sm text-gray-600">증거 품질</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              우수
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">2%</div>
            <div className="text-sm text-gray-600">환각률</div>
            <Badge className="mt-1 bg-green-100 text-green-800">안전</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">88%</div>
            <div className="text-sm text-gray-600">커버리지 점수</div>
            <Badge className="mt-1 bg-blue-100 text-blue-800">양호</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">0</div>
            <div className="text-sm text-gray-600">개인정보 위반</div>
            <Badge className="mt-1 bg-green-100 text-green-800">보안</Badge>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">87.5%</div>
            <div className="text-sm text-gray-600">전체 점수</div>
            <Badge className="mt-1 bg-green-100 text-green-800">
              우수
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
