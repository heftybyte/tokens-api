"use strict";

module.exports = function(app) {
  const Role = app.models.Role;
  // const APP_SUPER_EMAIL = process.env.APP_SUPER_EMAIL || 'esco@hbyte.com';

  function reject(cb) {
    process.nextTick(function() {
      cb(null, false);
    });
  }

  // function isAdmin(memberType) {
  //   var roles = ['superAdmin', 'admin'];
  //   return roles.indexOf(memberType) !== -1;
  // }

  // Role.registerResolver('super', function(role, context, cb){
  //   UserModel.findOne({ where: { email: APP_SUPER_EMAIL } })
  //     .then(function(user){
  //       return cb(null, user.id.toString() === context.accessToken.userId.toString());
  //     })
  //     .catch(function(err){
  //       return cb(err);
  //     });
  // });

  // Role.registerResolver('admin', function(role, context, cb){
  //   try {
  //     cb(null, isAdmin(context.accessToken.memberType));
  //   } catch(err) {
  //     reject(cb);
  //   }
  // });

  Role.registerResolver('ownsEmbedded', function(role, context, cb) {
    let userId;
    let id;

    try {
      userId = context.accessToken.userId.toString();
      id = String(context.remotingContext.ctorArgs.id)
    } catch(err) {
      console.log(err);
      return reject(cb);
    }

    if (!userId || id !== userId) {
      return reject(cb);
    }
    cb(null, true)
  });

  // Verify that user id in path is the same as in accessToken
  Role.registerResolver('identity', function(role, context, cb) {
    let userId;
    let id;

    try {
      userId = context.accessToken.userId.toString();
      id = String(context.remotingContext.ctorArgs.userId)
    } catch(err) {
      console.log(err);
      return reject(cb);
    }

    if (!userId || id !== userId) {
      return reject(cb);
    }
    cb(null, true)
  });

};
