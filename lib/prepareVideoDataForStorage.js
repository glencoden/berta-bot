const { MAX_NUM_VIDEO_TREND_STATISTICS } = require('./config')

const POPULARITY_GAIN_PERCENTAGE_WEIGHT = 0.8;
const VIEW_COUNT_WEIGHT = 0.7;
const LIKE_COUNT_WEIGHT = 0.3;

function prepareVideoDataForStorage(data, prevData) {
    if (!Array.isArray(data?.videos) || !Array.isArray(prevData?.videos)) {
        console.warn('expected array of videos on: ', data);
        return data;
    }

    let totalViewCount = 0;
    let totalLikeCount = 0;

    for (let i = 0; i < data.videos.length; i++) {
        const video = data.videos[i];
        const viewCount = parseInt(video.statistics?.viewCount);
        const likeCount = parseInt(video.statistics?.likeCount);

        if (!Number.isNaN(viewCount)) {
            totalViewCount += viewCount;
        }

        if (!Number.isNaN(likeCount)) {
            totalLikeCount += likeCount;
        }
    }

    const likeCountMakeupWeight = totalViewCount / (totalLikeCount || 1);

    return {
        ...data,
        videos: data.videos.map(video => {
            const prevVersion = prevData.videos.find(prevVideo => prevVideo.id === video.id);

            const trendStatistics = prevVersion?.trendStatistics ?? [];

            trendStatistics
                .sort((a, b) => b.timestamp - a.timestamp)
                .unshift({
                    timestamp: data.updatedAt,
                    statistics: video.statistics,
                });

            while (trendStatistics.length > MAX_NUM_VIDEO_TREND_STATISTICS) {
                trendStatistics.pop();
            }

            const popularity = getPopularity(video.statistics, likeCountMakeupWeight);

            const popularityGain = (Array.isArray(trendStatistics) && trendStatistics.length > 1)
                ? popularity - getPopularity(trendStatistics[trendStatistics.length - 1].statistics, likeCountMakeupWeight)
                : 0;

            const popularityGainInPercent = popularityGain / popularity * 100;

            const percentageTrend = popularity * popularityGainInPercent;

            const trend = Math.round((1 - POPULARITY_GAIN_PERCENTAGE_WEIGHT) * popularityGain + POPULARITY_GAIN_PERCENTAGE_WEIGHT * percentageTrend);

            return {
                ...video,
                trendStatistics,
                statistics: {
                    ...video.statistics,
                    popularity,
                    trend,
                }
            };
        })
    }
}

function getPopularity(statistics, likeCountMakeupWeight) {
    const viewCount = parseInt(statistics?.viewCount);
    const likeCount = parseInt(statistics?.likeCount);

    if (Number.isNaN(viewCount) || Number.isNaN(likeCount)) {
        console.warn('expected viewCount and likeCount to be parsed as numbers on: ', statistics);
        return 0;
    }

    const viewCountTerm = statistics.viewCount * VIEW_COUNT_WEIGHT;
    const likeCountTerm = statistics.likeCount * LIKE_COUNT_WEIGHT * likeCountMakeupWeight;

    return Math.floor(viewCountTerm + likeCountTerm);
}

module.exports = prepareVideoDataForStorage;