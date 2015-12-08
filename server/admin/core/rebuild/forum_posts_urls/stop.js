// Stop link extraction from forum posts
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function forum_posts_urls_stop(env, callback) {
    N.queue.cancel('forum_posts_urls', N.queue.worker('forum_posts_urls').taskID(), callback);
  });
};
