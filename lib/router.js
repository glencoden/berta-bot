const fs = require('fs');
const path = require('path');
const { ALLOWED_RESOURCES, CACHE_PATH, YOUTUBE_API_CACHE_STALE_TIME } = require('./config');
const getYoutubeData = require('./getYoutubeData');

function bertaRouter(app, express) {
    const router = express.Router();

    router.get('*', async (req, res) => {
        const resourceType = req.query.resource;

        if (!ALLOWED_RESOURCES.includes(resourceType)) {
            res.send(`Pass requested resource type with query param. (resource=${ALLOWED_RESOURCES.join(' | ')})`);
            return;
        }

        const cacheValue = await getCacheValue(resourceType);
        res.json(cacheValue);
    });

    return router;
}

const pollingInterval = 1000 * 60 * 60;

function pollCacheUpdate() {
    Promise.all(ALLOWED_RESOURCES.map(async (resourceType) => {
        const cacheValue = await getCacheValue(resourceType);

        const currentTimestamp = Date.now();
        const staleTimestamp = cacheValue.updatedAt + YOUTUBE_API_CACHE_STALE_TIME;

        if (currentTimestamp > staleTimestamp) {
            return await updateCache(resourceType);
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
        return await updateCache(resourceType); // updateCache writes the cache file to the file system
    }

    return JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
}

async function updateCache(resourceType) {
    const youtubeData = await getYoutubeData(resourceType);
    await writeToStorage(youtubeData, resourceType);
    return youtubeData;
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