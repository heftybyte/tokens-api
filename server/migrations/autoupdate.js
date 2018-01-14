import server from '../server';

// redis connection prevents script from exiting
import redisClient from '../../server/boot/redisConnector';
redisClient.quit();

const ds = server.dataSources.mongodb;

const model = process.argv[2];

const collections = model ?
	[model] :
	server.models().map((model)=>model.modelName);

collections.forEach((modelName) => {
  ds.isActual(modelName, (err, isActual) => {
    if (isActual) {
      return;
    }

    ds.autoupdate(modelName, (err)=> {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`updated ${modelName}`);
    });
  });
});
