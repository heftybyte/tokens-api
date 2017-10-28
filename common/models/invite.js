{
	"strict": true
}

module.exports = function(Invite) {
  Invite.getCode = (cb) => {
    let code = Invite.generateCode()
	  Invite.create({invite_code: code}, (err, instance) => {
		  if (err) {
			  const error = new Error(err.message);
			  error.status = 400;
			  cb(error);
		  }
		  cb(null, instance);
	  });
  };

  Invite.generateCode = () => {
	  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	  let text = '';

	  for (let i = 0; i < 2; i++)
		  text += possible.charAt(Math.floor(Math.random() * possible.length));

	  return text + (new Date().getTime()).toString(36);
  };

  Invite.remoteMethod('getCode', {
    http: {
      path: '/code',
      verb: 'get',
    },
    returns: {
	    name: 'code',
      'type': 'string',
    },
    description: 'Generate Invitation code',
  });
};
