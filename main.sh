#!/bin/bash

echo "🚀 QA Generation System - Replit 배포"
echo "====================================="

# 백엔드 의존성 설치 및 빌드
echo "📡 백엔드 설치 중..."
cd backend
npm install
npm run build

# 백엔드 시작 (백그라운드)
echo "🔧 백엔드 시작..."
npm start &
BACKEND_PID=$!
echo "✅ 백엔드: http://localhost:3002 (PID: $BACKEND_PID)"

# 프론트엔드 의존성 설치
echo "🌐 프론트엔드 설치 중..."
cd ../apps/fe-web
npm install

# 환경변수 설정
echo "NEXT_PUBLIC_API_BASE=http://localhost:3002" > .env.local

# 프론트엔드 빌드 및 시작
echo "🏗️ 프론트엔드 빌드..."
npm run build

echo "🎉 QA 시스템 시작 완료!"
echo "📱 웹사이트: http://localhost:3001"
echo "🔧 API: http://localhost:3002"

# 프론트엔드 시작 (메인 프로세스)
npm start