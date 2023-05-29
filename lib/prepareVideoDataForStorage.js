const { VIDEO_PAST_STATISTICS_CACHE_INTERVAL, MAX_VIDEO_PAST_STATISTICS } = require('./config')

const SAFETY_MARGIN = 1000 * 60 * 60;

function prepareVideoDataForStorage(data, prevData) {
    if (!Array.isArray(data?.videos) || !Array.isArray(prevData?.videos)) {
        return data;
    }

    return {
        updatedAt: data.updatedAt,
        videos: data.videos.map(video => {
            const prevVersion = prevData.videos.find(prevVideo => prevVideo.id === video.id);

            const pastStatistics = prevVersion?.pastStatistics ?? [];

            let mostRecentTimestamp = 0;

            for (let i = 0; i < pastStatistics.length; i++) {
                mostRecentTimestamp = Math.max(mostRecentTimestamp, pastStatistics[i].timestamp);
            }

            if ((mostRecentTimestamp + VIDEO_PAST_STATISTICS_CACHE_INTERVAL - SAFETY_MARGIN) < data.updatedAt) {
                pastStatistics.push({
                    timestamp: data.updatedAt,
                    statistics: video.statistics,
                });
            }

            return {
                ...video,
                pastStatistics: pastStatistics.slice(0, MAX_VIDEO_PAST_STATISTICS),
            };
        })
    }
}

module.exports = prepareVideoDataForStorage;