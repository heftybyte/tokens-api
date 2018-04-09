import server from '../server/server';
import blockchains from '../data/blockchains.json';

async function run() {
  
  const Blockchain = server.models.Blockchain;

  const savePromises = blockchains.sort((a, b)=>a.name > b.name ? 1 : -1)
    .map(blockchain => Blockchain.upsertWithWhere({ name: blockchain.name }, blockchain));

  Promise.all(savePromises)
    .then((blockchains) => {
      const blockchainsJSON = blockchains.map((blockchain)=>blockchain.toJSON());
      console.log('Seeded blockchain collection.');
      console.log(blockchainsJSON)
      process.exit()
    })
  .catch(e=>console.log(e))

};

run()