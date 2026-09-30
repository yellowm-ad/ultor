#!/bin/sh
# usage: dl-object.sh <objectId> <out.png>   — PixelLab map-object 다운로드(Bearer)
TOKEN=${PIXELLAB_TOKEN:-b8429f49-152d-480c-afc7-451eb5033691}
curl -sfL -H "Authorization: Bearer $TOKEN" "https://api.pixellab.ai/mcp/map-objects/$1/download" -o "$2" && echo "ok $2" || echo "FAIL $1"
