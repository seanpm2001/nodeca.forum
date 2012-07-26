"use strict";

/*global nodeca, _*/

var forum_breadcrumbs = require('../../lib/forum_breadcrumbs.js');
var to_tree = require('../../lib/to_tree.js');

var Section = nodeca.models.forum.Section;

var sections_in_fields = {
  '_id' : 1,
  'id' : 1,
  'title' : 1,
  'description' : 1,
  'parent' : 1,
  'parent_list' : 1,
  'moderator_list' : 1,
  'display_order' : 1,
  'cache' : 1
};


// fetch and prepare sections
//
// params is empty
module.exports = function (params, next) {
  var env = this;

  env.extras.puncher.start('Get forums');

  // build tree from 0..2 levels, start from sections without parent
  var query = { level: {$lte: 2}, };

  // ToDo get state conditions from env
  Section.find(query).select(sections_in_fields).sort('display_order')
      .setOptions({lean:true}).exec(function(err, sections){
    if (err) {
      env.extras.puncher.stop();
      next(err);
      return;
    }
    env.data.sections = sections;
    env.extras.puncher.stop({ count: sections.length });
    next();
  });
};


// init response and collect user ids
nodeca.filters.after('@', function forum_index_breadcrumbs(params, next) {
  var env = this;

  env.extras.puncher.start('Build sections tree');
  this.response.data.sections = to_tree(this.data.sections, null);
  env.extras.puncher.stop();


  env.extras.puncher.start('Collect user ids');
  env.data.users = env.data.users || [];

  // collect users from sections
  this.data.sections.forEach(function(doc){
    if (doc.moderator_list && _.isArray(doc.moderator_list)) {
      doc.moderator_list.forEach(function(user) {
        env.data.users.push(user);
      });
    }
    if (doc.cache.real.last_user) {
      env.data.users.push(doc.cache.real.last_user);
    }
  });
  env.extras.puncher.stop();

  next();
});


// breadcrumbs and head meta
nodeca.filters.after('@', function forum_index_breadcrumbs(params, next) {
  this.response.data.head.title = this.helpers.t('common.forum.title');
  this.response.data.widgets.breadcrumbs = forum_breadcrumbs(this);
  next();
});
