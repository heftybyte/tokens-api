import AccountSchema from '../../common/models/account.json';
import server from '../server';

const ds = server.dataSources.arangodbDs;

console.log('Attempting to migrate Accounts Model');

ds.createModel(
  AccountSchema.name, AccountSchema.properties, AccountSchema.options);
ds.automigrate((err, instance) => {
  console.log(err, instance);
});
