'use strict';

var _ = require('lodash');
var utils = require('./utils.js');

/**
 * Defines a set of filters available in swig templates
 * @param  {Object}   swig        Swig engine to add filters to
 */
module.exports.init = function (swig) {

  var upper = function(input) {
    return input.toUpperCase();
  };

  var slice = function(input, offset, limit) {
    if(Array.isArray(input))
    {
      return input.slice(offset || 0, limit)
    }

    return utils.sliceDictionary(input, offset, limit);
  };

  var sort = function(input, property) {
    return _.sortBy(input, property)
  };

  var reverse = function(input, reverse) {
    return _(input).reverse();
  };

  swig.setFilter('upper', upper);
  swig.setFilter('slice', slice);
};