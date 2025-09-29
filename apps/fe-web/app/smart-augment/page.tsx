'use client';

import { useState } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SessionLogger } from '@/lib/session-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, Brain, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import QualitySummaryDashboard from '@/components/QualitySummaryDashboard';
import ExpertFeedbackPanel from '@/components/ExpertFeedbackPanel';

interface AugmentationResult {
  analysis: {
    type: string;
    confidence: number;
    characteristics: string[];
  };
  augmentations: Array<{
    type: string;
    reason: string;
    results: any[];
    summary: any;
  }>;
  evaluation: {
    overallScore: number;
    metrics: {
      diversity: { score: number; description: string };
      quality: { score: number; description: string };
      relevance: { score: number; description: string };
      usefulness: { score: number; description: string };
    };
    recommendations: string[];
    bestVariants: any[];
  };
}

export default function SmartAugmentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [augmentCount, setAugmentCount] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AugmentationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setCurrentStep(2);
      setError(null);
    }
  };

  const handleAugmentCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(event.target.value);
    if (count > 0 && count <= 50) {
      setAugmentCount(count);
    }
  };

  const executeAugmentation = async () => {
    if (!file) return;

    setLoading(true);
    setCurrentStep(3);
    setError(null);

    try {
      // 1. 파일 업로드 (RAG 시스템에 등록)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('input_type', 'mixed'); // 청크 + 골든 QA 혼합

      const uploadResponse = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error || '파일 업로드에 실패했습니다.');
      }

      const uploadData = await uploadResponse.json();
      console.log('Upload successful:', uploadData);

      // RAG 세션 ID 저장 (전 과정 추적용)
      const ragSessionId = uploadData.sessionId;

      // 2. 파일 내용 읽기
      const fileContent = await file.text();

      // 3. 스마트 증강 실행
      const augmentResponse = await fetch('/api/smart-augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: fileContent,
          options: {
            customCount: augmentCount,
            includeRAG: true,
            ragSessionId: ragSessionId, // RAG 업로드와 연결
          },
        }),
      });

      if (!augmentResponse.ok) {
        const errorData = await augmentResponse.json();
        throw new Error(errorData.error || '데이터 증강에 실패했습니다.');
      }

      const augmentData = await augmentResponse.json();

      if (augmentData.success) {
        setResult(augmentData.session);

        // 세션 ID 설정
        const currentSessionId = `session_${Date.now()}`;
        setSessionId(currentSessionId);

        // 세션 로깅 (RAG 업로드와 연결)
        SessionLogger.logSession({
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
          inputMode: 'document',
          inputText: fileContent.substring(0, 500) + '...',
          inputLength: fileContent.length,
          detectedType: augmentData.session.analysis.type,
          confidence: augmentData.session.analysis.confidence,
          documentsUsed: [uploadData.document.filename],
          totalVariants: augmentData.session.augmentations.reduce(
            (sum: number, aug: any) => sum + aug.results.length,
            0
          ),
          overallScore: augmentData.session.evaluation.overallScore,
          processingTime: 0, // API에서 제공되지 않음
          metadata: {
            ragUsed: true,
            ragSessionId: ragSessionId, // RAG 업로드 세션과 연결
            inputType: uploadData.inputType, // mixed/document/gold
            contextChunks: augmentCount,
            bestVariantScore: augmentData.session.evaluation.bestVariants[0]?.quality?.score || 0,
          },
        });
      } else {
        throw new Error(augmentData.error || '증강에 실패했습니다.');
      }
    } catch (error) {
      console.error('Augmentation error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setAugmentCount(5);
    setResult(null);
    setError(null);
    setCurrentStep(1);
    setSessionId(null);
  };

  const handleFeedbackSubmit = async (feedbackData: any) => {
    try {
      const response = await fetch('/api/expert-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error('피드백 제출에 실패했습니다.');
      }

      const result = await response.json();
      console.log('피드백 제출 완료:', result);

      alert(`피드백이 성공적으로 접수되었습니다!\n\n다음 단계:\n${result.nextSteps?.join('\n') || '처리 중...'}`);
    } catch (error) {
      console.error('피드백 제출 오류:', error);
      throw error;
    }
  };

  const getStepIcon = (step: number) => {
    if (step < currentStep) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (step === currentStep && loading) return <Loader2 className="w-6 h-6 animate-spin text-blue-500" />;
    if (step === currentStep) return <div className="w-6 h-6 rounded-full bg-blue-500" />;
    return <div className="w-6 h-6 rounded-full bg-gray-300" />;
  };

  const getProgressPercentage = () => {
    if (result) return 100;
    if (currentStep === 3) return 75;
    if (currentStep === 2) return 50;
    return 25;
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Brain className="w-8 h-8" />
            스마트 데이터 증강 시스템
          </h1>
          <p className="text-gray-600">
            청크 문서와 골든 QA 예시를 업로드하여 자동으로 데이터를 증강하고 품질을 평가합니다.
          </p>
        </div>

        {/* 진행 상황 표시 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">진행 상황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={getProgressPercentage()} className="w-full" />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {getStepIcon(1)}
                  <span className={currentStep >= 1 ? 'font-medium' : 'text-gray-500'}>
                    1. 문서 업로드
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStepIcon(2)}
                  <span className={currentStep >= 2 ? 'font-medium' : 'text-gray-500'}>
                    2. 증강 설정
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStepIcon(3)}
                  <span className={currentStep >= 3 ? 'font-medium' : 'text-gray-500'}>
                    3. 자동 실행
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>오류 발생</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 단계별 UI */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                1단계: 문서 업로드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload" className="text-sm font-medium">
                    청크 문서 + 골든 QA 예시 파일 (.txt, .md, .rtf, .jsonl)
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".txt,.md,.rtf,.jsonl"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p>• 파일에는 청크 문서와 골든 QA 예시가 함께 포함되어야 합니다.</p>
                  <p>• 시스템이 자동으로 문서를 분석하여 적절한 증강을 수행합니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && file && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                2단계: 증강 설정
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">업로드된 파일: {file.name}</span>
                  <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                </div>

                <div>
                  <Label htmlFor="augment-count" className="text-sm font-medium">
                    증강할 데이터 개수
                  </Label>
                  <Input
                    id="augment-count"
                    type="number"
                    min="1"
                    max="50"
                    value={augmentCount}
                    onChange={handleAugmentCountChange}
                    className="mt-1 w-32"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    입력한 개수만큼 QA 데이터가 증강됩니다. (1-50개)
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={executeAugmentation} className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    자동 증강 실행
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    다시 시작
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && loading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                3단계: 자동 실행 중...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="text-sm text-gray-600">
                    문서 분석 및 데이터 증강을 진행하고 있습니다...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            {/* 새로운 품질 요약 대시보드 */}
            <QualitySummaryDashboard result={result} />

            {/* 전문가 피드백 패널 */}
            {sessionId && (
              <ExpertFeedbackPanel
                sessionId={sessionId}
                currentResult={result}
                onFeedbackSubmit={handleFeedbackSubmit}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  증강 완료!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium">분석 결과</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge>{result.analysis.type}</Badge>
                        <span className="text-sm text-gray-600">
                          (신뢰도: {(result.analysis.confidence * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        특성: {result.analysis.characteristics.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">전체 품질 점수</h4>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.evaluation.overallScore}/1.0
                      </div>
                      <Badge variant={result.evaluation.overallScore > 0.7 ? 'default' : 'secondary'}>
                        {result.evaluation.overallScore > 0.7 ? '우수' : '보통'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>품질 메트릭</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(result.evaluation.metrics).map(([key, metric]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium capitalize">
                          {key === 'diversity' && '다양성'}
                          {key === 'quality' && '품질'}
                          {key === 'relevance' && '관련성'}
                          {key === 'usefulness' && '유용성'}
                        </span>
                        <span className="text-sm font-bold">{metric.score}</span>
                      </div>
                      <Progress value={metric.score * 100} className="h-2" />
                      <p className="text-xs text-gray-600">{metric.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>증강 결과 요약</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.augmentations.map((aug, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{aug.type}</Badge>
                        <span className="text-sm text-gray-600">
                          {aug.results.length}개 생성
                        </span>
                      </div>
                      <p className="text-sm">{aug.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline">
                새로운 증강 시작
              </Button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}