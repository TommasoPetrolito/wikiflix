# Sports Streams API Setup

## Configuration Required

Before using the sports streams feature, you need to update the API URL in `src/utils/streams.ts`:

```typescript
const STREAMS_API_URL = 'https://your-api-domain.com/api/streams'; // Update with actual API URL
```

Replace `'https://your-api-domain.com/api/streams'` with your actual API endpoint URL.

## Features

- ✅ Live streams detection with "LIVE" badge
- ✅ Upcoming streams detection with "UPCOMING" badge  
- ✅ Automatic refresh every minute (as recommended by API docs)
- ✅ 1-minute caching to avoid hammering the API
- ✅ Category-based organization
- ✅ Responsive grid layout
- ✅ Stream player modal with iframe embed
- ✅ Keyboard navigation support (TV remote compatible)
- ✅ Error handling and loading states

## Usage

The sports streams page is accessible via:
- Navigation: Click "Sports" in the navbar
- Direct URL: `/sports`

## API Response Handling

The app handles:
- Streams with `iframe` property (ready to play)
- Streams without `iframe` (shows "not available" message)
- Live streams (displays "LIVE" badge)
- Upcoming streams (displays "UPCOMING" badge with start time)
- Past streams (filtered out unless `allowpaststreams` is 1)

## Caching

The API response is cached for 1 minute to:
- Reduce API calls
- Improve performance
- Follow API recommendations (don't poll on every page load)

## Notes

- The API endpoint must support CORS (`Access-Control-Allow-Origin: *`)
- The app respects the API's terms (doesn't alter embed functionality)
- Streams are only displayed if they have an `iframe` property

