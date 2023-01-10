const https = require('https');
const { URL, URLSearchParams } = require('url');
const { GOOGLE_API_MAX_RESULTS, YOUTUBE_API_URL, YOUTUBE_CHANNEL_ID } = require('./config');

const YOUTUBE_API_KEY = process.env.BERTA_YOUTUBE_API_KEY;

/**
 * Request service
 */
class RequestService {
    _get(url, search = {}) {
        console.log(`GET - ${url} - ${JSON.stringify(search)}`);

        const requestUrl = new URL(url);
        requestUrl.search = new URLSearchParams(search).toString();

        return new Promise((resolve, reject) => {
            https.get(requestUrl.toString(), resp => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    resolve(JSON.parse(data));
                });
            }).on('error', reject);
        });
    }

    _search(type, pageToken) {
        return this._get(
            `${YOUTUBE_API_URL}/search`,
            {
                key: YOUTUBE_API_KEY,
                channelId: YOUTUBE_CHANNEL_ID,
                maxResults: GOOGLE_API_MAX_RESULTS,
                type,
                ...(pageToken ? { pageToken } : {}),
            },
        );
    }

    searchVideos(pageToken) {
        return this._search('video', pageToken);
    }

    getVideoData(ids) {
        return this._get(
            `${YOUTUBE_API_URL}/videos`,
            {
                key: YOUTUBE_API_KEY,
                id: ids,
                part: [ 'snippet', 'statistics' ],
            },
        );
    }

    searchPlaylists(pageToken) {
        return this._search('playlist', pageToken);
    }

    getPlaylistData(id) {
        return this._get(
            `${YOUTUBE_API_URL}/playlists`,
            {
                key: YOUTUBE_API_KEY,
                id,
                part: [ 'snippet', 'status' ],
            },
        );
    }

    getPlaylistItems(playlistId, pageToken) {
        return this._get(
            `${YOUTUBE_API_URL}/playlistItems`,
            {
                key: YOUTUBE_API_KEY,
                maxResults: GOOGLE_API_MAX_RESULTS,
                part: 'snippet',
                playlistId,
                ...(pageToken ? { pageToken } : {}),
            },
        );
    }
}

const requestService = new RequestService();

/**
 * Get berta berlin youtube data
 */
async function getYoutubeData(resource) {
    switch (resource) {
        case 'video': {
            const videos = await assembleVideoData();
            if (videos === null) {
                throw new Error('received no video data');
            }
            return {
                updatedAt: Date.now(),
                videos,
            };
        }
        case 'playlist': {
            const playlists = await assemblePlaylistData();
            if (playlists === null) {
                throw new Error('received no playlist data');
            }
            return {
                updatedAt: Date.now(),
                playlists,
            };
        }
        default:
            return 'unknown resource type';
    }
}

/**
 * Assemble video data
 */
async function assembleVideoData() {
    const searchItems = await iterateVideoSearch();
    if (!Array.isArray(searchItems)) {
        return null;
    }
    return searchItems;
}

async function iterateVideoSearch(pageToken, prevItems = []) {
    const searchResult = await requestService.searchVideos(pageToken);
    if (!Array.isArray(searchResult.items)) {
        return null;
    }
    const maxItemsResultLength = searchResult.pageInfo && searchResult.pageInfo.totalResults;
    const nextPageToken = searchResult.nextPageToken;

    const videoIds = searchResult.items.map(item => (item && item.id && item.id.videoId));
    const videoDataResult = await requestService.getVideoData(videoIds);
    if (!Array.isArray(videoDataResult.items)) {
        return null;
    }
    const currentItems = videoDataResult.items.map(parseVideo);

    const itemsResult = [ ...prevItems, ...currentItems ];

    if (itemsResult.length >= maxItemsResultLength) {
        return itemsResult;
    }
    return iterateVideoSearch(nextPageToken, itemsResult);
}

function parseVideo(video) {
    return {
        id: video && video.id,
        statistics: video && video.statistics,
        title: video && video.snippet && video.snippet.title,
        description: video && video.snippet && video.snippet.description,
        thumbnails: video && video.snippet && video.snippet.thumbnails,
        publishedAt: video && video.snippet && video.snippet.publishedAt,
        tags: video && video.snippet && video.snippet.tags,
    };
}

/**
 * Assemble playlist data
 */
async function assemblePlaylistData() {
    const searchItems = await iteratePlaylistSearch();
    if (!Array.isArray(searchItems)) {
        return null;
    }
    return searchItems;
}

async function iteratePlaylistSearch(pageToken, prevPlaylists = []) {
    const searchResult = await requestService.searchPlaylists(pageToken);
    if (!Array.isArray(searchResult.items)) {
        return null;
    }
    const maxItemsResultLength = searchResult.pageInfo && searchResult.pageInfo.totalResults;
    const nextPageToken = searchResult.nextPageToken;

    const playlistIds = searchResult.items.map(item => (item && item.id && item.id.playlistId));
    const currentPlaylists = await iteratePlaylists(playlistIds);

    const playlistsResult = [ ...prevPlaylists, ...currentPlaylists ];

    if (playlistsResult.length >= maxItemsResultLength) {
        return playlistsResult;
    }
    return iteratePlaylistSearch(nextPageToken, playlistsResult);
}

async function iteratePlaylists(playlistIds, prevPlaylists = []) {
    const currentPlaylistId = playlistIds.shift();
    const playlistResult = await requestService.getPlaylistData(currentPlaylistId);
    if (!Array.isArray(playlistResult.items)) {
        return null;
    }
    const videoIds = await iteratePlaylistItems(currentPlaylistId);
    if (videoIds === null) {
        return null;
    }
    const currentPlaylist = {
        ...parsePlaylist(playlistResult.items[0]),
        videoIds,
    };
    const playlistsResult = [ ...prevPlaylists, currentPlaylist ];
    if (playlistIds.length === 0) {
        return playlistsResult;
    }
    return iteratePlaylists(playlistIds, playlistsResult);
}

function parsePlaylist(playlist) {
    return {
        id: playlist && playlist.id,
        title: playlist && playlist.snippet && playlist.snippet.title,
        description: playlist && playlist.snippet && playlist.snippet.description,
        thumbnails: playlist && playlist.snippet && playlist.snippet.thumbnails,
        publishedAt: playlist && playlist.snippet && playlist.snippet.publishedAt,
        isPrivate: playlist && playlist.status && playlist.status.privacyStatus !== 'public',
    };
}

async function iteratePlaylistItems(playlistId, pageToken, prevItems = []) {
    const playlistItemsResult = await requestService.getPlaylistItems(playlistId, pageToken);
    if (!Array.isArray(playlistItemsResult.items)) {
        return null;
    }
    const maxItemsResultLength = playlistItemsResult.pageInfo && playlistItemsResult.pageInfo.totalResults;
    const nextPageToken = playlistItemsResult.nextPageToken;

    const currentItems = playlistItemsResult.items.map(parsePlaylistItem);

    const itemsResult = [ ...prevItems, ...currentItems ];

    if (itemsResult.length >= maxItemsResultLength) {
        return itemsResult;
    }
    return iteratePlaylistItems(playlistId, nextPageToken, itemsResult);
}

function parsePlaylistItem(playlistItem) {
    return playlistItem && playlistItem.snippet && playlistItem.snippet.resourceId && playlistItem.snippet.resourceId.videoId;
}

module.exports = getYoutubeData;