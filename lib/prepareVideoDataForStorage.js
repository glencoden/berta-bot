const { VIDEO_TREND_PERIOD, MAX_NUM_VIDEO_TREND_STATISTICS } = require('./config')

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

            const trendStatistics = (prevVersion?.trendStatistics ?? []).slice(0, MAX_NUM_VIDEO_TREND_STATISTICS);

            // unshift with current statistics to aim at the correct statistics data by using video trend period as an index
            trendStatistics
                .sort((a, b) => b.timestamp - a.timestamp)
                .unshift({
                    timestamp: data.updatedAt,
                    statistics: video.statistics,
                });

            const popularity = getPopularity(video.statistics, likeCountMakeupWeight);

            const popularityGainLookingBack = [];

            let currentPopularity = popularity;
            let index = VIDEO_TREND_PERIOD;

            while (trendStatistics[index]) {
                const previousPopularity = getPopularity(trendStatistics[index].statistics, likeCountMakeupWeight);
                const popularityGain = currentPopularity - previousPopularity;
                const popularityGainPerThousand = popularityGain / previousPopularity * 1000;

                popularityGainLookingBack.push(popularityGainPerThousand);

                currentPopularity = previousPopularity;

                index += VIDEO_TREND_PERIOD;
            }

            let trend = 0;

            if (popularityGainLookingBack.length > 1) {
                const [ currentPopularityGain, ...previousPopularityGains ] = popularityGainLookingBack;

                const averagePreviousPopularityGain = previousPopularityGains.reduce((sum, popularityGain) => sum + popularityGain, 0) / previousPopularityGains.length;

                trend = Math.floor(1000 + currentPopularityGain - averagePreviousPopularityGain);
            }

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