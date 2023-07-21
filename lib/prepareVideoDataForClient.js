function prepareVideoDataForClient(data) {
    if (!Array.isArray(data?.videos)) {
        console.warn('expected array of videos on: ', data);
        return data;
    }

    return {
        ...data,
        videos: data.videos.map((video) => {
            const { trendStatistics, ...videoWithoutTrendStatistics } = video;

            return videoWithoutTrendStatistics; // still contains statistics: { popularity, trend }
        }),
    }
}

module.exports = prepareVideoDataForClient;