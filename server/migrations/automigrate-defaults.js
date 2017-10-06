import server from '../server';

const ds = server.dataSources.db;

const defaultTables = ['User', 'AccessToken', 'ACL', 'RoleMapping', 'Role'];
ds.automigrate(defaultTables, err => {
  if (err) throw err;
  console.log(
      'Loopback tables [' - defaultTables - '] created in ', ds.adapter.name);
  ds.disconnect();
});
