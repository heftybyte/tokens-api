module.exports = function(AppMeta) {
  AppMeta.version = function(cb) {
    let version = '1.0.0';
    cb(null, {version});
  };

  AppMeta.remoteMethod(
    'version', {
      http: {
        path: '/version',
        verb: 'get',
      },
      returns: {
	      root: true,
      },
    }
  );
};

