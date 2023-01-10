const path = require('path');

module.exports = {
    CACHE_PATH: path.resolve('files', 'berta-cache'),
    ALLOWED_ORIGIN: '*',
    ALLOWED_RESOURCES: [ 'video', 'playlist' ],
    GOOGLE_API_MAX_RESULTS: 50,
    YOUTUBE_API_CACHE_STALE_TIME: 1000 * 60 * 60 * 24,
    YOUTUBE_API_URL: 'https://www.googleapis.com/youtube/v3',
    YOUTUBE_CHANNEL_ID: 'UCz74WCGrXmY3On0l96NNaVA',
};