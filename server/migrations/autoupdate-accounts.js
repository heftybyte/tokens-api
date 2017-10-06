import AccountSchema from '../../common/models/account.json';
import server from '../server';

const ds = server.dataSources.arangodbDs;

ds.createModel(
  AccountSchema.name, AccountSchema.properties, AccountSchema.options);

ds.isActual(AccountSchema.name, (err, actual) => {
  if (err) throw err;
  if (!actual) {
    ds.autoupdate(AccountSchema.name, (err, result) => {
      console.error('An error occurred', err);
    });
  }
});
