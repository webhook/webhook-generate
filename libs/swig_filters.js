

// Set of twig filters we expose to users in the templates
module.exports.init = function (swig) {

  var upper = function(input) {
    return input.toUpperCase();
  };

  swig.setFilter('upper', upper);
};