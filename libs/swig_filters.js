
/**
 * Defines a set of filters available in swig templates
 * @param  {Object}   swig        Swig engine to add filters to
 */
module.exports.init = function (swig) {

  var upper = function(input) {
    return input.toUpperCase();
  };

  swig.setFilter('upper', upper);
};