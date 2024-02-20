// require('dotenv').config(); // TODO: use ESM with out dynamic import
const https = require('https');
const { URL, URLSearchParams } = require('url');
const { ALLOWED_RESOURCES, GOOGLE_API_MAX_RESULTS, YOUTUBE_API_URL, YOUTUBE_CHANNEL_ID } = require('./config');

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
                part: 'snippet',
                order: 'date',
                channelId: YOUTUBE_CHANNEL_ID,
                maxResults: GOOGLE_API_MAX_RESULTS,
                type,
                ...(pageToken ? { pageToken } : {}),
            },
        );
    }

    searchVideos(pageToken) {
        return this._search(ALLOWED_RESOURCES.VIDEO, pageToken);
    }

    getVideoData(ids) {
        return this._get(
            `${YOUTUBE_API_URL}/videos`,
            {
                key: YOUTUBE_API_KEY,
                id: ids,
                part: [ 'snippet', 'statistics', 'contentDetails' ],
            },
        );
    }

    searchPlaylists(pageToken) {
        return this._search(ALLOWED_RESOURCES.PLAYLIST, pageToken);
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
async function getYoutubeData(resource, payload) {
    switch (resource) {
        case ALLOWED_RESOURCES.VIDEO: {
            const videoIds = await assembleVideoIds();
            const videos = await assembleVideoData(videoIds);

            if (videos === null) {
                throw new Error('received no video data');
            }

            return {
                updatedAt: Date.now(),
                count: videos.length,
                videos,
            };
        }
        case ALLOWED_RESOURCES.PLAYLIST: {
            const playlists = await assemblePlaylistData();

            if (playlists === null) {
                throw new Error('received no playlist data');
            }

            return {
                updatedAt: Date.now(),
                count: playlists.length,
                playlists,
            };
        }
        case ALLOWED_RESOURCES.EXTERNAL_VIDEO: {
            const videoIds = payload.videos.map((video) => video.id);

            const playlistVideoIds = payload.playlists.reduce((result, playlist) => [ ...result, ...playlist.videoIds ], []);

            const externalVideoIds = playlistVideoIds.filter((videoId) => !videoIds.includes(videoId));

            const videos = await assembleVideoData(externalVideoIds);

            return {
                updatedAt: Date.now(),
                count: videos.length,
                videos,
            };
        }
        case ALLOWED_RESOURCES.TRACKING:
            return null;
        default:
            return 'unknown resource type';
    }
}

/**
 * Assemble video data
 */
async function assembleVideoData(videoIds) {
    const result = [];

    while (videoIds.length > 0) {
        const currentIds = videoIds.splice(0, GOOGLE_API_MAX_RESULTS);

        const videoDataResult = await requestService.getVideoData(currentIds);

        const currentItems = (videoDataResult.items ?? []).map(parseVideo);

        result.push(...currentItems);
    }

    console.log('result length', result.length);

    const resultWithoutShorts = removeShorts(result);

    console.log('shorts removed length', resultWithoutShorts.length);

    return resultWithoutShorts;
}

async function assembleVideoIds() {
    const result = [];

    let done = false;
    let pageToken;

    while (!done) {
        const searchResult = await requestService.searchVideos(pageToken);

        console.log('TOTAL RESULTS', searchResult.pageInfo && searchResult.pageInfo.totalResults);

        const videoIds = (searchResult.items ?? []).map(item => (item && item.id && item.id.videoId));

        result.push(videoIds);

        pageToken = searchResult.nextPageToken;

        done = !pageToken;
    }

    return result.flat();
}

function parseISO8601Duration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    const hours = parseInt((match[1] || '').replace('H', '')) || 0;
    const minutes = parseInt((match[2] || '').replace('M', '')) || 0;
    const seconds = parseInt((match[3] || '').replace('S', '')) || 0;

    return hours * 3600 + minutes * 60 + seconds;
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
        duration: video && video.contentDetails && parseISO8601Duration(video.contentDetails.duration),
    };
}

function removeShorts(videos) {
    return videos.filter((video) => {
        if (video.duration > 60) {
            return true
        }
        console.log('REMOVE SHORT', video.title)
        return false
    });
}

/**
 * Assemble playlist data
 */

async function assemblePlaylistData() {
    const result = [];

    let done = false;
    let pageToken;

    while (!done) {
        const searchResult = await requestService.searchPlaylists(pageToken);

        const playlistIds = (searchResult.items ?? []).map(item => (item && item.id && item.id.playlistId));

        const currentPlaylists = await assemblePlaylists(playlistIds);

        result.push(currentPlaylists);

        pageToken = searchResult.nextPageToken;

        done = !pageToken;
    }

    return result.flat();
}

async function assemblePlaylists(playlistIds) {
    const result = [];

    while (playlistIds.length > 0) {
        const currentPlaylistId = playlistIds.shift();

        const playlistResult = await requestService.getPlaylistData(currentPlaylistId);
        const videoIds = await assemblePlaylistVideoIds(currentPlaylistId);

        result.push({
            ...(playlistResult.items ? parsePlaylist(playlistResult.items[0]) : {}),
            videoIds,
        });
    }

    return result;
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

async function assemblePlaylistVideoIds(playlistId) {
    const result = [];

    let done = false;
    let pageToken;

    while (!done) {
        const playlistItemsResult = await requestService.getPlaylistItems(playlistId, pageToken);

        const currentItems = (playlistItemsResult.items ?? []).map(parsePlaylistItem);

        result.push(currentItems);

        pageToken = playlistItemsResult.nextPageToken;

        done = !pageToken;
    }

    return result.flat();
}

function parsePlaylistItem(playlistItem) {
    return playlistItem && playlistItem.snippet && playlistItem.snippet.resourceId && playlistItem.snippet.resourceId.videoId;
}

module.exports = getYoutubeData;