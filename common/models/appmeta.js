module.exports = function(AppMeta) {
  AppMeta.appmeta = function(cb){

    var response = 'Sorry, we are closed. Open daily from 6am to 8pm.';
    cb(null, response);
  };
  AppMeta.remoteMethod(
    'appmeta', {
      http: {
        path: '/',
        verb: 'get',
      },
      returns: {
        arg: 'version',
        type: 'string',
      },
    }
  );
};

