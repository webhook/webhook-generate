'use strict';

var _ = require('lodash');
var utils = require('./utils.js');
var marked = require('marked');

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

  var sort = function(input, property, reverse) {
    if(reverse) {
      return _.sortBy(input, property).reverse();
    }
    
    return _.sortBy(input, property)
  };

  var reverse = function(input, reverse) {
    return _(input).reverse();
  };

  var groupBy = function (input, key) {
    if (!_.isArray(input)) {
      return input;
    }

    var out = {};

    _.forEach(input, function (value) {
      if (!value.hasOwnProperty(key)) {
        return;
      }

      var keyname = value[key],
        newVal = utils.extend({}, value);

      if (!out[keyname]) {
        out[keyname] = [];
      }

      out[keyname].push(value);
    });

    return out;
  };


  var imageSize = function(input, width, height, grow) {

    var params = [];
    if(width) {
      params.push('width=' + width);
    }

    if(height) {
      params.push('height=' + height);
    }

    if(grow) {
      params.push('grow=' + grow);
    }

    params.push('url=' + encodeURIComponent(input));
    params.push('key=13dde81b8137446e89c7933edca679eb');
    var imageSource = 'http://i.embed.ly/1/display/resize?' + params.join('&');
    
    return imageSource
  };

  var imageCrop = function(input, width, height) {

    var params = [];
    if(width) {
      params.push('width=' + width);
    }

    if(height) {
      params.push('height=' + height);
    }

    params.push('url=' + encodeURIComponent(input));
    params.push('key=13dde81b8137446e89c7933edca679eb');
    var imageSource = 'http://i.embed.ly/1/display/crop?' + params.join('&');
    
    return imageSource
  };
  
  

  var size = function(input) {
    return _(input).size();
  };

  var markdown = function(input) {
    return marked(input);
  }

  markdown.safe = true;

  swig.setFilter('upper', upper);
  swig.setFilter('slice', slice);
  swig.setFilter('sort', sort);
  swig.setFilter('reverse', reverse);
  swig.setFilter('imageSize', imageSize);
  swig.setFilter('imageCrop', imageCrop);
  swig.setFilter('size', size);
  swig.setFilter('groupBy', groupBy);
  swig.setFilter('markdown', markdown);
};