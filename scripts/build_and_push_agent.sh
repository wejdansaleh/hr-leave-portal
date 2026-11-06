#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${SCRIPT_DIR}/../hrAgent/app/agent"

REPO_NAME="hr-agent"
IMAGE_TAG="${1:-latest}"
# The stack reads the pushed image URI from this SSM parameter.
IMAGE_URI_PARAM="/hr-leave-portal/agent-image-uri"
# AgentCore Runtime only accepts linux/arm64 images.
PLATFORM="linux/arm64"
# finch by default; set CONTAINER_CLI=docker to use Docker instead.
CONTAINER_CLI="${CONTAINER_CLI:-finch}"

if ! command -v "${CONTAINER_CLI}" >/dev/null 2>&1; then
  echo "ERROR: '${CONTAINER_CLI}' not found on PATH." >&2
  exit 1
fi

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region || true)}}"
if [[ -z "${REGION}" ]]; then
  echo "ERROR: no AWS region set. Configure one with 'aws configure' or set AWS_REGION." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${REPO_NAME}:${IMAGE_TAG}"

echo "Image: ${IMAGE_URI} (${PLATFORM}) via ${CONTAINER_CLI}"

# Create the ECR repo if it doesn't exist.
if ! aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "Creating ECR repository '${REPO_NAME}'..."
  aws ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --region "${REGION}" \
    --image-scanning-configuration scanOnPush=true >/dev/null
fi

echo "Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" \
  | "${CONTAINER_CLI}" login --username AWS --password-stdin "${REGISTRY}"

# The Dockerfile's base image lives on ECR Public; a stale anonymous token can
# 403, so log in explicitly. ECR Public always uses us-east-1.
echo "Logging in to ECR Public..."
aws ecr-public get-login-password --region us-east-1 \
  | "${CONTAINER_CLI}" login --username AWS --password-stdin public.ecr.aws

echo "Building and pushing ${IMAGE_URI}..."
"${CONTAINER_CLI}" build --platform "${PLATFORM}" -t "${IMAGE_URI}" "${AGENT_DIR}"
"${CONTAINER_CLI}" push "${IMAGE_URI}"

# Store the URI in SSM so the stack reads it at synth time, no copy-paste.
aws ssm put-parameter \
  --name "${IMAGE_URI_PARAM}" \
  --type String \
  --overwrite \
  --value "${IMAGE_URI}" \
  --region "${REGION}" >/dev/null

echo
echo "Done. Image pushed and URI stored in ${IMAGE_URI_PARAM}:"
echo "  ${IMAGE_URI}"
echo "Deploy with: uv run cdk deploy HrLeavePortalAgentRuntime"