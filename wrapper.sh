#!/bin/bash

# Get start time in milliseconds
START_TIME=$(date +%s%N | cut -b1-13)

# Stats file
STATS_FILE="/tmp/stats_$$_$(date +%s%N).json"

# Extract input file if provided via environment
INPUT_FILE="${WRAPPER_INPUT_FILE}"

# Run the program
if [ -n "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]; then
    "$@" < "$INPUT_FILE" &
else
    "$@" &
fi
PID=$!

# Track memory usage
PEAK_MEM=0
while kill -0 $PID 2>/dev/null; do
    if [ -f /proc/$PID/status ]; then
        CURR_MEM=$(grep VmRSS /proc/$PID/status | awk '{print $2}')
        if [ ! -z "$CURR_MEM" ] && [ $CURR_MEM -gt $PEAK_MEM ]; then
            PEAK_MEM=$CURR_MEM
        fi
    fi
    sleep 0.01
done

wait $PID
EXIT_CODE=$?

# Get end time
END_TIME=$(date +%s%N | cut -b1-13)
EXEC_TIME=$((END_TIME - START_TIME))

# Convert KB to MB
PEAK_MEM_MB=$(echo "scale=2; $PEAK_MEM / 1024" | bc 2>/dev/null || echo "0")

# Output stats to file
echo "{\"execTimeMs\":$EXEC_TIME,\"peakMemoryKB\":$PEAK_MEM,\"peakMemoryMB\":$PEAK_MEM_MB,\"exitCode\":$EXIT_CODE}" > "$STATS_FILE"

echo "STATS_FILE:$STATS_FILE" >&2

exit $EXIT_CODE