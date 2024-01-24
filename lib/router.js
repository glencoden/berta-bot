const fs = require('fs');
const path = require('path');
const { ALLOWED_RESOURCES, CACHE_PATH, YOUTUBE_API_CACHE_STALE_TIME } = require('./config');
const getYoutubeData = require('./getYoutubeData');
const prepareVideoDataForStorage = require('./prepareVideoDataForStorage');
const prepareVideoDataForClient = require('./prepareVideoDataForClient');

let videoRequestCount = 0; // for tracking on every cache update

function bertaRouter(app, express) {
    const router = express.Router();

    router.get('*', async (req, res) => {
        const returnRawData = req.query.raw === 'true';
        const noCache = req.query['no-cache'] === 'true';
        const resourceType = req.query.resource;
        const allowedResourceTypeValues = Object.values(ALLOWED_RESOURCES);

        if (!allowedResourceTypeValues.includes(resourceType)) {
            res.send(`Pass requested resource type with query param. (resource=${allowedResourceTypeValues.join(' | ')})`);
            return;
        }

        let result = await getCacheValue(resourceType, noCache);

        if (returnRawData) {
            return res.json(result);
        }

        switch (resourceType) {
            case ALLOWED_RESOURCES.VIDEO: {
                videoRequestCount++;
                result = prepareVideoDataForClient(result);
                break;
            }
        }

        res.json(result);
    });

    return router;
}

/**
 * Caching logic
 */

const pollingInterval = 1000 * 60 * 60;

function pollCacheUpdate() {
    Promise.all(Object.values(ALLOWED_RESOURCES).map(async (resourceType) => {
        const cacheValue = await getCacheValue(resourceType);

        const staleTimestamp = cacheValue.updatedAt + YOUTUBE_API_CACHE_STALE_TIME;

        if (Number.isNaN(staleTimestamp) || Date.now() > staleTimestamp) {
            return await updateCache(resourceType, cacheValue);
        }
        return Promise.resolve()
    }))
        .then(() => setTimeout(pollCacheUpdate, pollingInterval));
}

pollCacheUpdate();

async function getCacheValue(resourceType, noCache = false) {
    const cacheFilePath = path.join(CACHE_PATH, `${resourceType}.json`);

    if (!fs.existsSync(CACHE_PATH)) {
        fs.mkdirSync(CACHE_PATH, { recursive: true });
    }

    if (!fs.existsSync(cacheFilePath)) {
        return await updateCache(resourceType, null); // updateCache writes the cache file to the file system
    }

    if (noCache) {
        const prevData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        return await updateCache(resourceType, prevData);
    }

    return JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
}

async function updateCache(resourceType, prevData) {
    let payload = null;

    if (resourceType === ALLOWED_RESOURCES.EXTERNAL_VIDEO) {
        const { videos } = await getCacheValue(ALLOWED_RESOURCES.VIDEO);
        const { playlists } = await getCacheValue(ALLOWED_RESOURCES.PLAYLIST);

        payload = {
            videos,
            playlists,
        };
    }

    let storageData = await getYoutubeData(resourceType, payload);

    switch (resourceType) {
        case ALLOWED_RESOURCES.VIDEO: {
            storageData = prepareVideoDataForStorage(storageData, prevData);
            break;
        }
        case ALLOWED_RESOURCES.EXTERNAL_VIDEO: {
            storageData = prepareVideoDataForStorage(storageData, prevData);
            break;
        }
        case ALLOWED_RESOURCES.TRACKING: {
            const currentTrackingEntry = {
                timestamp: Date.now(),
                videoRequestCount,
            };

            videoRequestCount = 0;

            const trackingEntries = prevData !== null
                ? [ ...prevData.trackingEntries, currentTrackingEntry ]
                : [ currentTrackingEntry ];

            const totalRequests = trackingEntries.reduce((acc, entry) => acc + entry.videoRequestCount, 0);
            const daysSinceFirstRequest = Math.round(Date.now() - trackingEntries[0].timestamp) / (1000 * 60 * 60 * 24);
            const averageRequestsPerDay = daysSinceFirstRequest > 0 ? Math.round(totalRequests / daysSinceFirstRequest) : 0;

            storageData = {
                updatedAt: Date.now(),
                totalRequests,
                daysSinceFirstRequest,
                averageRequestsPerDay,
                trackingEntries,
            }

            break;
        }
    }

    await writeToStorage(storageData, resourceType);

    return storageData;
}

async function writeToStorage(data, resourceType) {
    const file = JSON.stringify(data, null, 4);
    const filePath = path.join(CACHE_PATH, `${resourceType}.json`);

    return new Promise((resolve, reject) => {
        fs.mkdir(CACHE_PATH, { recursive: true }, () => {
            fs.writeFile(filePath, file, (err) => {
                if (err !== null) {
                    reject(err);
                }
                resolve();
            });
        });
    });
}

module.exports = bertaRouter;