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
      return input.slice(offset || 0, offset + limit)
    }

    return utils.sliceDictionary(input, limit, offset);
  };

  var sort = function(input, property) {
    return _.sortBy(input, property)
  };

  var reverse = function(input, reverse) {
    return _(input).reverse();
  };

  this.imageSize = function(input, width, height) {
    if(width && !height)
    {
      return input + '?width=' + width;
    } else if (height && !width) {
      return input + '?height=' + height;
    }
    
    return input + '?width=' + width + '&height=' + height;
  };

  swig.setFilter('upper', upper);
  swig.setFilter('slice', slice);
  swig.setFilter('sort', sort);
  swig.setFilter('reverse', reverse);
  swig.setFilter('imageSize', reverse);
};