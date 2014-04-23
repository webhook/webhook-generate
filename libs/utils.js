'use strict';

var _ = require('lodash');

/**
 * Extends source dictionaries into the target dictionary
 * @param  {Object}   target        Target to extend into
 * @param  {Objects}  sources       Sources to extend from
 * @return {Object}   Returns the target
 */
module.exports.extend = function(target) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function (source) {
      for (var prop in source) {
          target[prop] = source[prop];
      }
  });
  return target;
};

/**
 * Slices a dictionary
 * @param  {Object}   dict        Object to slice
 * @param  {Integer}  limit       Number of items to return
 * @param  {Integer}  offset      Offset to slice to (From limit)
 * @return {Object}   Sliced dictionary
 */
module.exports.sliceDictionary = function(dict, limit, offset) {
  var keys = [];

  limit = limit || -1;
  offset = offset || -1;

  for(var key in dict)
  {
    if(dict.hasOwnProperty(key))
    {
      keys.push(key);
    }
  }

  if(limit !== -1 && offset !== -1)
  {
    keys = keys.slice(offset, offset + limit);
  } else if (limit !== -1) {
    keys = keys.slice(0, limit);
  } else if (offset !== -1) {
    keys = keys.slice(offset);
  } 

  var slicedDict = {};

  keys.forEach(function(key) {
    slicedDict[key] = dict[key];
  });

  return slicedDict;
};

module.exports.slice = function(data, limit, offset) {
  if(Array.isArray(data))
  {
    return data.slice(offset, limit + offset);
  } else {
    return this.sliceDictionary(data, limit, offset);
  }
};

module.exports.each = function(obj, cb) {
  _.each(obj, cb);
};
