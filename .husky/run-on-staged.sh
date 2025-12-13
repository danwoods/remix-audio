#!/bin/bash
# Generic script to run a command on staged files
# Usage: ./run-on-staged.sh <command> [file-extensions]
# Example: ./run-on-staged.sh "deno fmt" "ts,tsx,js,jsx,json,md"
# Example: ./run-on-staged.sh "deno lint --fix" "ts,tsx"

set -e

COMMAND="$1"
FILE_EXTENSIONS="${2:-}"

if [ -z "$COMMAND" ]; then
  echo "Error: Command is required"
  echo "Usage: $0 <command> [file-extensions]"
  echo "Example: $0 'deno fmt' 'ts,tsx,js,jsx,json,md'"
  exit 1
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "No staged files to process"
  exit 0
fi

# Filter files by extension if provided
if [ -n "$FILE_EXTENSIONS" ]; then
  # Convert comma-separated extensions to a pattern
  IFS=',' read -ra EXT_ARRAY <<< "$FILE_EXTENSIONS"
  PATTERN=""
  for ext in "${EXT_ARRAY[@]}"; do
    # Remove leading dot if present
    ext="${ext#.}"
    if [ -z "$PATTERN" ]; then
      PATTERN="\.($ext"
    else
      PATTERN="$PATTERN|$ext"
    fi
  done
  PATTERN="$PATTERN)$"
  
  # Filter staged files by extension pattern
  FILTERED_FILES=$(echo "$STAGED_FILES" | grep -E "$PATTERN" || true)
else
  # No filter - use all staged files
  FILTERED_FILES="$STAGED_FILES"
fi

if [ -z "$FILTERED_FILES" ]; then
  echo "No staged files match the specified extensions"
  exit 0
fi

# Convert newline-separated files to space-separated for command
FILES_TO_PROCESS=$(echo "$FILTERED_FILES" | tr '\n' ' ')

if [ -z "$FILES_TO_PROCESS" ]; then
  exit 0
fi

# Run the command on filtered files
echo "Running: $COMMAND on staged files..."
eval "$COMMAND $FILES_TO_PROCESS"

# Stage any changes made by the command
CHANGED_FILES=$(git diff --name-only)
if [ -n "$CHANGED_FILES" ]; then
  echo "Staging changes made by command..."
  echo "$CHANGED_FILES" | xargs git add
fi












