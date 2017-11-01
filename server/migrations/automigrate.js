import server from '../server';

// redis connection prevents script from exiting
import redisClient from '../../server/boot/redisConnector';
redisClient.quit();

const ds = server.dataSources.arangodbDs;
const model = process.argv[2];

const collections = model ?
	[model] :
	server.models().map((model)=>model.modelName);

collections.forEach((modelName)=>{
  ds.automigrate(modelName, (err)=> {
	  if (err) {
	  	console.error(err);
	  	return;
	  }
	  console.log(`migrated ${modelName}`);
  });
});
