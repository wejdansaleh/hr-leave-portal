#!/usr/bin/env bash
set -euo pipefail

# Build the React app, then deploy hosting, backend and UI stacks.
npm --prefix ui ci
npm --prefix ui run build

uv run cdk deploy --all

UI_URL=$(aws cloudformation describe-stacks \
  --stack-name HrLeavePortalUiHosting \
  --query "Stacks[0].Outputs[?OutputKey=='UiUrl'].OutputValue" \
  --output text)

echo "UI is available at $UI_URL"
