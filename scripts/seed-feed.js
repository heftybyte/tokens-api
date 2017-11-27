import server from '../server/server';
import FeedData from '../MockData';
import redisClient from '../server/boot/redisConnector';

const {Feed} = server.models;

const feedModels = FeedData.map((feed) => {
  const {title, type, body, link, image, format} = feed;
  return {title, type, body, link, image, format};
});

Feed.create(feedModels,
    (err, models) => console.log(
        'Feed seeding failed' ? err : 'Feed data seeded'
    )
);

redisClient.quit();
