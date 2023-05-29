const { MAX_NUM_VIDEO_TREND_STATISTICS } = require('./config')

function prepareVideoDataForStorage(data, prevData) {
    if (!Array.isArray(data?.videos) || !Array.isArray(prevData?.videos)) {
        return data;
    }

    return {
        ...data,
        videos: data.videos.map(video => {
            const prevVersion = prevData.videos.find(prevVideo => prevVideo.id === video.id);

            const trendStatistics = prevVersion?.trendStatistics ?? [];

            trendStatistics.unshift({
                timestamp: data.updatedAt,
                statistics: video.statistics,
            });

            trendStatistics.sort((a, b) => b.timestamp - a.timestamp)

            return {
                ...video,
                trendStatistics: trendStatistics.slice(0, MAX_NUM_VIDEO_TREND_STATISTICS),
            };
        })
    }
}

module.exports = prepareVideoDataForStorage;