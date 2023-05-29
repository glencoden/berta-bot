const path = require('path');

const cacheStaleTime = 1000 * 60 * 60 * 24;
const devCacheStaleTime = cacheStaleTime * 100;

module.exports = {
    CACHE_PATH: path.resolve('files', 'berta-cache'),
    ALLOWED_ORIGIN: '*',
    ALLOWED_RESOURCES: {
        VIDEO: 'video',
        PLAYLIST: 'playlist'
    },
    MAX_NUM_VIDEO_TREND_STATISTICS: 14,
    GOOGLE_API_MAX_RESULTS: 50,
    YOUTUBE_API_CACHE_STALE_TIME: process.env.HOST_ENV === 'prod' ? cacheStaleTime : devCacheStaleTime,
    YOUTUBE_API_URL: 'https://www.googleapis.com/youtube/v3',
    YOUTUBE_CHANNEL_ID: 'UCz74WCGrXmY3On0l96NNaVA',
};