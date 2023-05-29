function prepareVideoDataForClient(data) {
    if (!Array.isArray(data?.videos)) {
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
        videos: data.videos.map((video) => {
            const { statistics, trendStatistics, ...videoWithoutStatistics } = video;

            const popularity = getPopularity(statistics, likeCountMakeupWeight);

            const trend = (Array.isArray(trendStatistics) && trendStatistics.length > 1)
                ? popularity - getPopularity(trendStatistics[trendStatistics.length - 1].statistics, likeCountMakeupWeight)
                : 0;

            return {
                ...videoWithoutStatistics,
                statistics: {
                    ...statistics,
                    popularity,
                    trend,
                }
            };
        }),
    }
}

const VIEW_COUNT_WEIGHT = 0.7;
const LIKE_COUNT_WEIGHT = 0.3;

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

module.exports = prepareVideoDataForClient;