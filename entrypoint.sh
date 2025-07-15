#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# 1. Get Pull Request context
# These are automatically provided by the GitHub Actions runner
PR_NUMBER=$(jq -r ".number" "$GITHUB_EVENT_PATH")
BASE_SHA=$(jq -r ".pull_request.base.sha" "$GITHUB_EVENT_PATH")
HEAD_SHA=$(jq -r ".pull_request.head.sha" "$GITHUB_EVENT_PATH")
REPO_OWNER=$(jq -r ".repository.owner.login" "$GITHUB_EVENT_PATH")
REPO_NAME=$(jq -r ".repository.name" "$GITHUB_EVENT_PATH")

# Configure git with a dummy user
git config --global user.name "github-actions"
git config --global user.email "github-actions@github.com"
# The GITHUB_WORKSPACE is mounted by default, so we need to make it safe for git operations
git config --global --add safe.directory "$GITHUB_WORKSPACE"


# 2. Create the diff
echo "Creating diff between $BASE_SHA and $HEAD_SHA"
# Fetch the specific commits to ensure they are available for diffing
git fetch origin $BASE_SHA --depth=1
git fetch origin $HEAD_SHA --depth=1
git diff $BASE_SHA $HEAD_SHA > changes.patch

# Read the patch file content
PATCH_CONTENT=$(cat changes.patch)

# Check if the patch file is empty
if [ -z "$PATCH_CONTENT" ]; then
  echo "No content changes detected."
  exit 0
fi

# 3. Call the external API to summarize the changes
API_URL="https://4djfomzutg.execute-api.us-west-2.amazonaws.com/v1/api"
API_KEY="ojR4WdbesL8l3pXNhsBlVau1FwBq5u9i1WL1nA16" # Consider moving this to a secret

echo "Calling summarization API..."

# Prepare the JSON payload
JSON_BODY=$(jq -n \
  --arg patch "$PATCH_CONTENT" \
  '{
    "user_id": "ftsai",
    "prompts": ["Summarize the changes in this pull request: \n\n\($patch)"],
    "model": "ollama.deepseek-r1:latest"
  }')

# Use curl to make the API request
API_RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "$JSON_BODY")

# Extract the summary from the JSON response
SUMMARY=$(echo "$API_RESPONSE" | jq -r .response)

echo "API Response received."

# 4. Post the summary as a comment on the Pull Request
echo "Posting comment to PR #$PR_NUMBER"

# Prepare the comment body
COMMENT_BODY=$(jq -n --arg summary "$SUMMARY" '{"body": $summary}')

# Use the GitHub API to create the comment
curl -s -X POST "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$COMMENT_BODY"

echo "Comment posted successfully."
