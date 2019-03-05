// Show edit history
//

'use strict';


const _                = require('lodash');
const sanitize_section = require('nodeca.forum/lib/sanitizers/section');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    post_id: { format: 'mongo', required: true }
  });


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_see_history = await env.extras.settings.fetch('can_see_history');

    if (!can_see_history) throw N.io.FORBIDDEN;
  });


  // Fetch post
  //
  N.wire.before(apiPath, async function fetch_post(env) {
    let post = await N.models.forum.Post.findById(env.params.post_id).lean(true);

    if (!post) throw N.io.NOT_FOUND;

    env.data.post = post;
  });


  // Fetch topic
  //
  N.wire.before(apiPath, async function fetch_topic(env) {
    let topic = await N.models.forum.Topic.findOne({ _id: env.data.post.topic }).lean(true);

    if (!topic) throw N.io.NOT_FOUND;

    env.data.topic = topic;
  });


  // Check if user can see this post
  //
  N.wire.before(apiPath, async function check_access(env) {
    let access_env = { params: {
      topics: env.data.topic,
      user_info: env.user_info
    } };

    await N.wire.emit('internal:forum.access.topic', access_env);

    if (!access_env.data.access_read) throw N.io.NOT_FOUND;

    // Check permissions manually here instead of calling `forum.access.post`
    // to account for deleted posts (history should still be shown to
    // moderators).
    //
    env.extras.settings.params.section_id = env.data.topic.section;
    env.data.settings = await env.extras.settings.fetch([
      'can_see_hellbanned',
      'forum_mod_can_delete_topics',
      'forum_mod_can_hard_delete_topics'
    ]);

    let postVisibleSt = [ N.models.forum.Post.statuses.VISIBLE ];

    if (env.data.settings.can_see_hellbanned || env.user_info.hb) {
      postVisibleSt.push(N.models.forum.Post.statuses.HB);
    }

    if (env.data.settings.forum_mod_can_delete_topics) {
      postVisibleSt.push(N.models.forum.Post.statuses.DELETED);
    }

    if (env.data.settings.forum_mod_can_see_hard_deleted_topics) {
      postVisibleSt.push(N.models.forum.Post.statuses.DELETED_HARD);
    }

    if (postVisibleSt.indexOf(env.data.post.st) === -1) throw N.io.NOT_FOUND;
  });


  // Using different sanitizers here,
  // because we need to expose editable fields (md) and don't need
  // autogenerated ones (bookmarks, views, html)
  //
  function sanitize_topic(topic) {
    if (!topic) return topic; // nothing to sanitize

    // we can always hide HB status, because it doesn't affect client diffs
    if (topic.st === N.models.forum.Topic.statuses.HB) {
      topic = Object.assign({}, topic);
      topic.st = topic.ste;
      delete topic.ste;
    }

    if (topic.prev_st && topic.prev_st.st === N.models.forum.Topic.statuses.HB) {
      topic.prev_st = Object.assign({}, topic.prev_st);
      topic.prev_st.st = topic.prev_st.ste;
      delete topic.prev_st.ste;
    }

    return _.pick(topic, [
      'title',
      'section',
      'st',
      'ste',
      'del_reason',
      'del_by',
      'prev_st'
    ]);
  }


  function sanitize_post(post) {
    // we can always hide HB status, because it doesn't affect client diffs
    if (post.st === N.models.forum.Post.statuses.HB) {
      post = Object.assign({}, post);
      post.st = post.ste;
      delete post.ste;
    }

    if (post.prev_st && post.prev_st.st === N.models.forum.Post.statuses.HB) {
      post.prev_st = Object.assign({}, post.prev_st);
      post.prev_st.st = post.prev_st.ste;
      delete post.prev_st.ste;
    }

    return _.pick(post, [
      'md',
      'st',
      'ste',
      'del_reason',
      'del_by',
      'prev_st'
    ]);
  }


  // Fetch and return post edit history
  //
  N.wire.on(apiPath, async function get_post_history(env) {
    let history = await N.models.forum.PostHistory.find()
                            .where('post').equals(env.data.post._id)
                            .sort('_id')
                            .lean(true);

    let history_meta = [ {
      user: env.data.post.user,
      ts:   env.data.post.ts,
      role: N.models.forum.PostHistory.roles.USER
    } ].concat(
      _.map(history, i => ({ user: i.user, ts: i.ts, role: i.role }))
    );

    let history_topics = _.map(history, 'topic_data')
                          .concat([ env.data.post.hid <= 1 ? env.data.topic : null ])
                          .map(sanitize_topic);

    let history_posts = _.map(history, 'post_data')
                         .concat([ env.data.post ])
                         .map(sanitize_post);

    env.res.history = _.zip(history_meta, history_topics, history_posts)
                       .map(([ meta, topic, post ]) => ({ meta, topic, post }));

    env.data.users = (env.data.users || []).concat(_.map(env.res.history, 'meta.user'));
  });


  // Fetch sections
  //
  N.wire.after(apiPath, async function fetch_sections(env) {
    let sections = [];
    let section_ids = _.uniq(_.map(env.res.history, 'topic.section').filter(Boolean).map(String));

    if (section_ids) {
      sections = await N.models.forum.Section.find()
                           .where('_id').in(section_ids)
                           .lean(true);
    }

    env.res.sections = _.keyBy(await sanitize_section(N, sections, env.user_info), '_id');
  });
};
