module.exports = function(AppMeta) {
  AppMeta.version = async function(cb) {
    let err
    const meta = await AppMeta.findOne().catch(e=>err=e)
    if (err) {
      cb(err)
      return
    }
    const { version } = meta
    cb(null, version);
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

