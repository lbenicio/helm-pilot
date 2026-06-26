#!/bin/sh
set -e

VERSION="${1}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.4"
  exit 1
fi

IMAGE_DH="lbenicio/helm-pilot"
IMAGE_GH="ghcr.io/lbenicio/helm-pilot"

echo "Building helm-pilot:${VERSION}..."
docker build --platform linux/amd64 -t "${IMAGE_DH}:latest" -t "${IMAGE_DH}:${VERSION}" -t "${IMAGE_GH}:latest" -t "${IMAGE_GH}:${VERSION}" .

echo ""
echo "Pushing to Docker Hub..."
docker push "${IMAGE_DH}:latest"
docker push "${IMAGE_DH}:${VERSION}"

echo ""
echo "Pushing to GitHub Container Registry..."
docker push "${IMAGE_GH}:latest"
docker push "${IMAGE_GH}:${VERSION}"

echo ""
echo "Done. Tags pushed:"
echo "  ${IMAGE_DH}:latest"
echo "  ${IMAGE_DH}:${VERSION}"
echo "  ${IMAGE_GH}:latest"
echo "  ${IMAGE_GH}:${VERSION}"
