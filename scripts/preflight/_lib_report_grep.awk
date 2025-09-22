#!/usr/bin/awk -f
# BSD/macOS compatible AWK utility for parsing markdown reports
# Usage: awk -f _lib_report_grep.awk report.md

BEGIN {
    # Initialize variables
    in_summary_block = 0
    field_name = ""
    field_value = ""
}

# Detect start of summary block (code fence or SESSION_ID line)
/^```/ || /^SESSION_ID:/ {
    if (!in_summary_block) {
        in_summary_block = 1
        next
    } else {
        # End of summary block
        in_summary_block = 0
        next
    }
}

# Parse fields within summary block
in_summary_block && /^[A-Z_]+:/ {
    # Split on first colon
    colon_pos = index($0, ":")
    if (colon_pos > 0) {
        field_name = substr($0, 1, colon_pos - 1)
        field_value = substr($0, colon_pos + 1)
        # Trim leading/trailing whitespace
        gsub(/^[ \t]+|[ \t]+$/, "", field_value)
        print field_name "=" field_value
    }
}

# Extract DLQ count from dedicated section
/^Failed runs in DLQ:/ {
    match($0, /[0-9]+/)
    if (RSTART > 0) {
        print "DLQ_COUNT_PARSED=" substr($0, RSTART, RLENGTH)
    }
}

# Extract specific gate status markers
/Gate Status.*:/ {
    if (match($0, /(PASS|FAIL|WARN|PARTIAL)/)) {
        print "GATE_STATUS=" substr($0, RSTART, RLENGTH)
    }
}

# Extract orchestration layer indicators
/Contract:|Envelope|QUEUED.*RUNNING.*DONE/ {
    print "ORCHESTRATION_CONTRACT=found"
}

/Checkpoint|checkpoint.*jsonl|restart.*point/ {
    print "ORCHESTRATION_CHECKPOINT=found"
}

/agent.*cost.*cap|Per-agent.*Policy|agent.*time.*cap/ {
    print "ORCHESTRATION_POLICY=found"
}

# Extract budget/cost guard indicators
/budget.*guard|HARD_STOP|budget.*exceeded|cost.*cap/ {
    print "BUDGET_GUARD=found"
}

# Extract retry/DLQ policy indicators
/429|5xx|timeout.*backoff|retry.*policy|DLQ.*isolation/ {
    print "RETRY_POLICY=found"
}

# Extract standard log fields presence
/RUN_ID.*ITEM_ID.*AGENT_ROLE|COST.*LAT_MS.*RETRIES/ {
    print "STANDARD_FIELDS=found"
}

# Extract seed/randomness indicators
/seed.*fixed|sampling.*seed|random.*seed/ {
    print "SEED_FIXED=found"
}

# Extract manifest/checksum indicators
/manifest|checksum|data.*fixed|RUN_ID.*reference/ {
    print "DATA_MANIFEST=found"
}