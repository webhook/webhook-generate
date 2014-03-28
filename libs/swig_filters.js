'use strict';

var _ = require('lodash');
var utils = require('./utils.js');
var marked = require('marked');

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function (str){
    return this.slice(-str.length) == str;
  };
}

/**
 * Defines a set of filters available in swig templates
 * @param  {Object}   swig        Swig engine to add filters to
 */
module.exports.init = function (swig) {

  var siteDns = '';

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
    if(_.size(input) === 0) {
      return input;
    }

    var first = input[0];
    var sortProperty = '_sort_' + property;

    if(first[sortProperty]) {
      property = sortProperty;
    }

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

    if(!input) {
      return '';
    }

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

    if(input.indexOf('http://') === -1) {
      input = 'http://' + siteDns + input;
    }

    params.push('url=' + encodeURIComponent(input));
    params.push('key=13dde81b8137446e89c7933edca679eb');
    var imageSource = 'http://i.embed.ly/1/display/resize?' + params.join('&');

    return imageSource
  };

  var imageCrop = function(input, width, height) {

    if(!input) {
      return '';
    }
    
    var params = [];
    if(width) {
      params.push('width=' + width);
    }

    if(height) {
      params.push('height=' + height);
    }

    if(input.indexOf('http://') === -1) {
      input = 'http://' + siteDns + input;
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

  var startsWith = function(input, string) {
    if(typeof(input) !== "string") {
      return false;
    }

    return input.startsWith(string);
  };

  var endsWith = function(input, string) {
    if(typeof(input) !== "string") {
      return false;
    }
    
    return input.endsWith(string);
  };

  this.setSiteDns = function(dns) {
    siteDns = dns;
  }

  markdown.safe = true;

  swig.setFilter('upper', upper);
  swig.setFilter('slice', slice);
  swig.setFilter('sort', sort);
  swig.setFilter('startsWith', startsWith);
  swig.setFilter('endsWith', endsWith)
  swig.setFilter('reverse', reverse);
  swig.setFilter('imageSize', imageSize);
  swig.setFilter('imageCrop', imageCrop);
  swig.setFilter('size', size);
  swig.setFilter('groupBy', groupBy);
  swig.setFilter('markdown', markdown);
};