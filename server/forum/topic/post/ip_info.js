// Get post IP info
//
'use strict';


var whois = require('node-whois');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    post_id: { format: 'mongo', required: true }
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env, callback) {
    env.extras.settings.fetch('can_see_ip', function (err, can_see_ip) {
      if (err) {
        callback(err);
        return;
      }

      if (!can_see_ip) {
        callback(N.io.FORBIDDEN);
        return;
      }

      callback();
    });
  });


  // Fetch post IP
  //
  N.wire.on(apiPath, function fetch_post_ip(env, callback) {
    N.models.forum.Post
        .findOne({ _id: env.params.post_id })
        .select('ip')
        .lean(true)
        .exec(function (err, post) {
      if (err) {
        callback(err);
        return;
      }

      if (!post) {
        callback(N.io.NOT_FOUND);
        return;
      }

      if (!post.ip) {
        callback({
          code: N.io.CLIENT_ERROR,
          message: env.t('err_no_ip')
        });
        return;
      }

      env.res.ip = env.data.ip = post.ip;
      callback();
    });
  });


  // Fetch whois info
  //
  N.wire.after(apiPath, function fetch_whois(env, callback) {
    whois.lookup(env.data.ip, function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      env.res.whois = data;
      callback();
    });
  });
};
