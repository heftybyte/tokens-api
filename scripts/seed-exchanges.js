import server from '../server/server';
import exchanges from '../data/exchanges.json';

async function run() {
  
  const Exchange = server.models.Exchange;

  const savePromises = exchanges.sort((a, b)=>a.name > b.name ? 1 : -1)
    .map(exchange => Exchange.upsertWithWhere({ name: exchange.name }, exchange));

  Promise.all(savePromises)
    .then((exchanges) => {
      const exchangesJSON = exchanges.map((exchange)=>exchange.toJSON());
      console.log('Seeded exchange collection.');
      console.log(exchangesJSON)
      process.exit()
    })
  .catch(e=>console.log(e))

};

run()