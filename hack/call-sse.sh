#!/bin/bash

# A simple script to just get the content from the star-search sse.
# Very useful when testing alongside the logs in the API.
#
# For testing against the live URL, use the following:
# url="https://beta.api.opensauced.pizza/v2/star-search/stream"

url="http://localhost:3003/v2/star-search/stream"

# Use curl to connect to the SSE endpoint, then filter and format the output using awk

curl -sN -X 'POST' "$url" \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "query_text": "What are recent pull requests in kubernetes/kubernetes?"
}' | awk -F 'data: ' '/^data: / { printf "%s", $2 }'

