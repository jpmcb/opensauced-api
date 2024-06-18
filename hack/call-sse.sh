#!/bin/bash

# A simple script to just get the content from the star-search sse.
# Very useful when testing alongside the logs in the api.
#
# Modify the following env vars to enable hitting the star search stream endpoint
# against your own thread and API:

BEARER_TOKEN=""
UUID=""
URL="http://localhost:3003/v2/star-search/${UUID}/stream"

# Use curl to connect to the SSE endpoint, then filter and format the output using awk

curl -sN -X 'POST' "${URL}" \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${BEARER_TOKEN}" \
  -d '{
  "query_text": "What are recent pull requests in kubernetes/kubernetes?"
}' | awk -F 'data: ' '/^data: / { printf "%s", $2 }'

