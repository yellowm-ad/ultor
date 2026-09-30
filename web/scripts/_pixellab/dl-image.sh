#!/bin/sh
# usage: dl-image.sh <jobId> <index> <out.png>  — PixelLab 이미지(pro/pixflux) 후보 다운로드
TOKEN=${PIXELLAB_TOKEN:-b8429f49-152d-480c-afc7-451eb5033691}
curl -sfL -H "Authorization: Bearer $TOKEN" "https://api.pixellab.ai/mcp/images/$1/download?index=$2" -o "$3" && echo "ok $3" || echo "FAIL $1"
