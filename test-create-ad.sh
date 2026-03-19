#!/bin/bash

curl -X POST http://localhost:5050/api/v1/ads/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODVhMDUzNTk0NGNmMzMwYTZkZjFlNTEiLCJ1c2VyUm9sZSI6ImFwcHphcF9hZG1pbiIsInN1YiI6IjY4NWEwNTM1OTQ0Y2YzMzBhNmRmMWU1MSIsImlhdCI6MTc3Mzc0Mjk4NywiZXhwIjozMzMwOTc0Mjk4NywidHlwZSI6ImFjY2VzcyIsInVzZXJUeXBlIjoic3RhZmYifQ.BFEaHh8MbcioozzFNvWhCRSSWjAnv8-A22F0ouNOZyg" \
  -d @- << 'EOF'
{
  "name": "Heineken Summer Campaign",
  "description": "Summer promotion for Heineken 0.0",
  "type": "banner",
  "placement": "eat_hero_banner",
  "advertiser": {
    "name": "Heineken",
    "companyName": "Heineken Laos Co., Ltd",
    "phone": "+856 20 1234 5678",
    "email": "marketing@heineken.la"
  },
  "content": {
    "imageUrl": "https://cdn.appzap.la/ads/heineken-banner.jpg",
    "imageUrlMobile": "https://cdn.appzap.la/ads/heineken-banner-mobile.jpg",
    "title": "Heineken 0.0 - Now Available",
    "subtitle": "Order now and get 20% off",
    "ctaText": "Order Now",
    "ctaUrl": "appzap://restaurant/123"
  },
  "pricing": {
    "type": "cpm",
    "amount": 5
  },
  "budget": {
    "total": 1000,
    "daily": 100
  },
  "schedule": {
    "startDate": "2024-03-20T00:00:00Z",
    "endDate": "2024-06-30T23:59:59Z"
  },
  "priority": 90,
  "weight": 80
}
EOF
