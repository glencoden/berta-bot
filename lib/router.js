const fs = require('fs');
const path = require('path');
const { ALLOWED_RESOURCES, CACHE_PATH, YOUTUBE_API_CACHE_STALE_TIME } = require('./config');
const getYoutubeData = require('./getYoutubeData');
const prepareVideoDataForStorage = require('./prepareVideoDataForStorage')

function bertaRouter(app, express) {
    const router = express.Router();

    router.get('*', async (req, res) => {
        const resourceType = req.query.resource;
        const allowedResourceTypeValues = Object.values(ALLOWED_RESOURCES);

        if (!allowedResourceTypeValues.includes(resourceType)) {
            res.send(`Pass requested resource type with query param. (resource=${allowedResourceTypeValues.join(' | ')})`);
            return;
        }

        const cacheValue = await getCacheValue(resourceType);
        res.json(cacheValue);
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

        const currentTimestamp = Date.now();
        const staleTimestamp = cacheValue.updatedAt + YOUTUBE_API_CACHE_STALE_TIME;

        if (currentTimestamp > staleTimestamp) {
            return await updateCache(resourceType, cacheValue);
        }
        return Promise.resolve()
    }))
        .then(() => setTimeout(pollCacheUpdate, pollingInterval));
}

pollCacheUpdate();

async function getCacheValue(resourceType) {
    const cacheFilePath = path.join(CACHE_PATH, `${resourceType}.json`);

    if (!fs.existsSync(CACHE_PATH)) {
        fs.mkdirSync(CACHE_PATH, { recursive: true });
    }

    if (!fs.existsSync(cacheFilePath)) {
        return await updateCache(resourceType, null); // updateCache writes the cache file to the file system
    }

    return JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
}

async function updateCache(resourceType, prevData) {
    let storageData = await getYoutubeData(resourceType);

    switch (resourceType) {
        case ALLOWED_RESOURCES.VIDEO: {
            storageData = prepareVideoDataForStorage(storageData, prevData);
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