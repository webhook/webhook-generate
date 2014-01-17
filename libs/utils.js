'use strict';

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
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
