#!/bin/bash

# Development Server Manager
# 개발 서버 관리 및 포트 충돌 방지 스크립트

set -e

PROJECT_NAME="fe-web"
DEFAULT_PORT=3001
LOCK_FILE="/tmp/${PROJECT_NAME}-dev-server.lock"
PID_FILE="/tmp/${PROJECT_NAME}-dev-server.pid"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 포트 사용 확인
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # 포트 사용 중
    else
        return 1  # 포트 사용 가능
    fi
}

# 기존 개발 서버 정리
cleanup_existing_servers() {
    log_info "기존 개발 서버 프로세스 정리 중..."

    # Next.js 개발 서버 프로세스 찾기 및 종료
    local processes=$(ps aux | grep -E "(next dev|npm run dev)" | grep -v grep | awk '{print $2}')

    if [ -n "$processes" ]; then
        log_warn "기존 개발 서버 프로세스 발견: $processes"
        echo "$processes" | xargs kill -TERM 2>/dev/null || true
        sleep 2

        # 여전히 실행 중인 프로세스가 있으면 강제 종료
        local remaining=$(ps aux | grep -E "(next dev|npm run dev)" | grep -v grep | awk '{print $2}')
        if [ -n "$remaining" ]; then
            log_warn "강제 종료 필요한 프로세스: $remaining"
            echo "$remaining" | xargs kill -KILL 2>/dev/null || true
        fi

        log_success "기존 프로세스 정리 완료"
    else
        log_info "실행 중인 개발 서버 프로세스 없음"
    fi
}

# 포트 정리
cleanup_port() {
    local port=$1
    log_info "포트 $port 정리 중..."

    if check_port $port; then
        local pid=$(lsof -ti:$port)
        if [ -n "$pid" ]; then
            log_warn "포트 $port 사용 중인 프로세스: $pid"
            kill -TERM $pid 2>/dev/null || true
            sleep 2

            # 여전히 사용 중이면 강제 종료
            if check_port $port; then
                local remaining_pid=$(lsof -ti:$port)
                if [ -n "$remaining_pid" ]; then
                    log_warn "포트 $port 강제 해제: $remaining_pid"
                    kill -KILL $remaining_pid 2>/dev/null || true
                fi
            fi
        fi
    fi

    if ! check_port $port; then
        log_success "포트 $port 사용 가능"
    else
        log_error "포트 $port 해제 실패"
        return 1
    fi
}

# 캐시 정리
cleanup_cache() {
    log_info "캐시 정리 중..."

    local cache_dirs=(
        ".next"
        "node_modules/.cache"
        ".turbo"
    )

    for dir in "${cache_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_info "캐시 디렉토리 삭제: $dir"
            rm -rf "$dir"
        fi
    done

    log_success "캐시 정리 완료"
}

# 락 파일 확인
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            log_error "다른 개발 서버가 실행 중입니다 (PID: $lock_pid)"
            log_info "기존 서버를 종료하려면: $0 stop"
            return 1
        else
            log_warn "오래된 락 파일 제거"
            rm -f "$LOCK_FILE"
        fi
    fi
    return 0
}

# 락 파일 생성
create_lock() {
    local pid=$1
    echo "$pid" > "$LOCK_FILE"
    echo "$pid" > "$PID_FILE"
}

# 서버 시작
start_server() {
    log_info "개발 서버 시작 준비..."

    # 락 파일 확인
    if ! check_lock; then
        return 1
    fi

    # 기존 서버 정리
    cleanup_existing_servers

    # 포트 정리
    cleanup_port $DEFAULT_PORT

    # 캐시 정리
    cleanup_cache

    # API 키 확인
    if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -f ".env.local" ]; then
        log_warn "ANTHROPIC_API_KEY가 설정되지 않았습니다"
        log_info "백업에서 복구하시겠습니까? (y/N): "
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            if [ -f "scripts/restore-env.sh" ]; then
                bash scripts/restore-env.sh
            else
                log_error "복구 스크립트를 찾을 수 없습니다"
            fi
        fi
    fi

    log_info "개발 서버 시작 중... (포트 $DEFAULT_PORT)"

    # npm run dev를 백그라운드에서 실행
    npm run dev > "/tmp/${PROJECT_NAME}-dev.log" 2>&1 &
    local server_pid=$!

    # 락 파일 생성
    create_lock $server_pid

    # 서버 시작 대기
    local max_wait=30
    local wait_count=0

    while [ $wait_count -lt $max_wait ]; do
        if check_port $DEFAULT_PORT; then
            log_success "개발 서버가 성공적으로 시작되었습니다!"
            log_info "서버 주소: http://localhost:$DEFAULT_PORT"
            log_info "PID: $server_pid"
            log_info "로그 파일: /tmp/${PROJECT_NAME}-dev.log"
            return 0
        fi

        sleep 1
        wait_count=$((wait_count + 1))
        echo -n "."
    done

    echo ""
    log_error "서버 시작 시간 초과"

    # 실패 시 정리
    if kill -0 $server_pid 2>/dev/null; then
        kill $server_pid
    fi
    rm -f "$LOCK_FILE" "$PID_FILE"

    return 1
}

# 서버 중지
stop_server() {
    log_info "개발 서버 중지 중..."

    local stopped=false

    # PID 파일에서 종료
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_info "서버 프로세스 종료 중 (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
            sleep 3

            if kill -0 "$pid" 2>/dev/null; then
                log_warn "강제 종료 중..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
            stopped=true
        fi
        rm -f "$PID_FILE"
    fi

    # 추가 정리
    cleanup_existing_servers
    cleanup_port $DEFAULT_PORT

    # 락 파일 제거
    rm -f "$LOCK_FILE"

    if [ "$stopped" = true ]; then
        log_success "개발 서버가 중지되었습니다"
    else
        log_info "중지할 서버가 없습니다"
    fi
}

# 서버 상태 확인
status_server() {
    log_info "개발 서버 상태 확인..."

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_success "개발 서버 실행 중 (PID: $pid)"

            if check_port $DEFAULT_PORT; then
                log_success "포트 $DEFAULT_PORT 활성화"

                # API 상태 확인
                if curl -s "http://localhost:$DEFAULT_PORT/api/status" > /dev/null; then
                    log_success "API 엔드포인트 응답 정상"
                else
                    log_warn "API 엔드포인트 응답 없음"
                fi
            else
                log_warn "포트 $DEFAULT_PORT 비활성화"
            fi

            return 0
        else
            log_warn "PID 파일 존재하지만 프로세스 없음"
            rm -f "$PID_FILE"
        fi
    fi

    if check_port $DEFAULT_PORT; then
        log_warn "포트 $DEFAULT_PORT은 사용 중이지만 관리되지 않는 프로세스"
        local pid=$(lsof -ti:$DEFAULT_PORT)
        log_info "사용 중인 PID: $pid"
    else
        log_info "개발 서버 실행되지 않음"
    fi

    rm -f "$LOCK_FILE"
    return 1
}

# 로그 확인
show_logs() {
    local log_file="/tmp/${PROJECT_NAME}-dev.log"

    if [ -f "$log_file" ]; then
        log_info "개발 서버 로그 (마지막 50줄):"
        echo "==========================================="
        tail -n 50 "$log_file"
        echo "==========================================="
    else
        log_warn "로그 파일을 찾을 수 없습니다: $log_file"
    fi
}

# 도움말
show_help() {
    echo "Development Server Manager"
    echo ""
    echo "사용법: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start    개발 서버 시작 (기본값)"
    echo "  stop     개발 서버 중지"
    echo "  restart  개발 서버 재시작"
    echo "  status   서버 상태 확인"
    echo "  logs     서버 로그 확인"
    echo "  clean    캐시 및 프로세스 강제 정리"
    echo "  help     이 도움말 표시"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 clean && $0 start"
}

# 강제 정리
force_cleanup() {
    log_warn "강제 정리 시작..."

    cleanup_existing_servers
    cleanup_port $DEFAULT_PORT
    cleanup_cache

    rm -f "$LOCK_FILE" "$PID_FILE"
    rm -f "/tmp/${PROJECT_NAME}-dev.log"

    log_success "강제 정리 완료"
}

# 메인 실행 로직
main() {
    local command=${1:-start}

    case $command in
        start)
            start_server
            ;;
        stop)
            stop_server
            ;;
        restart)
            stop_server
            sleep 2
            start_server
            ;;
        status)
            status_server
            ;;
        logs)
            show_logs
            ;;
        clean)
            force_cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            show_help
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"