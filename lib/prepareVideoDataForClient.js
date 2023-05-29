function prepareVideoDataForClient(data) {
    if (!Array.isArray(data?.videos)) {
        console.warn('expected array of videos on: ', data);
        return data;
    }

    return {
        ...data,
        videos: data.videos.map((video) => {
            const { trendStatistics, ...videoWithoutTrendStatistics } = video;

            return videoWithoutTrendStatistics;
        }),
    }
}

module.exports = prepareVideoDataForClient;