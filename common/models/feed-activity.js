module.exports = function(FeedActivity) {
  FeedActivity.validatesInclusionOf('type', {in: ['view', 'bookmark', 'tap']});
};
