'use strict';

var _ = require('lodash');
var utils = require('./utils.js');
var marked = require('marked');
var dateFormatter = require('./dateformatter.js');

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


  var imageSize = function(input, size, deprecatedHeight, deprecatedGrow) {

    if(!input) {
      return '';
    }

    var imageSource = '';

    if(typeof input === 'object') {

      if(!size) {
        return input.url;
      }

      if(!input.resize_url) {
        return input.url;
      }

      imageSource = input.resize_url;

      imageSource = imageSource + '=s' + size;

    } else if (typeof input === 'string') {

      var params = [];
      if(size) {
        params.push('width=' + size);
      }

      if(deprecatedHeight) {
        params.push('height=' + deprecatedHeight);
      }

      if(deprecatedGrow) {
        params.push('grow=' + deprecatedGrow);
      }

      if(input.indexOf('http://') === -1) {
        input = 'http://' + siteDns + input;
      }

      params.push('url=' + encodeURIComponent(input));
      params.push('key=13dde81b8137446e89c7933edca679eb');
      imageSource = 'http://i.embed.ly/1/display/resize?' + params.join('&');
    }

    return imageSource
  };

  var imageCrop = function(input, size, deprecatedHeight) {

    if(!input) {
      return '';
    }
    
    var imageSource = '';

    if(typeof input === 'object') {

      if(!size) {
        return input.url;
      }

      imageSource = input.resize_url;

      imageSource = imageSource + '=s' + size + '-c';
      
    } else if (typeof input === 'string') {

      var params = [];
      if(size) {
        params.push('width=' + size);
      }

      if(deprecatedHeight) {
        params.push('height=' + deprecatedHeight);
      }

      if(input.indexOf('http://') === -1) {
        input = 'http://' + siteDns + input;
      }

      params.push('url=' + encodeURIComponent(input));
      params.push('key=13dde81b8137446e89c7933edca679eb');
      imageSource = 'http://i.embed.ly/1/display/crop?' + params.join('&');
    }
    
    return imageSource;
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

  var date = function(input, format, offset, abbr) {
    var l = format.length,
      date = new dateFormatter.DateZ(input),
      cur,
      i = 0,
      out = '';

    if(!offset && typeof input === 'string') {
      var offsetString = input.match(/[\+-]\d{2}:\d{2}$/);

      var modifier = 1;
      if(offsetString) {
        offsetString = offsetString[0];
        if(offsetString[0] === '+') {
          modifier = -1;
        }

        offsetString = offsetString.slice(1);
        var parts = offsetString.split(':');

        var hours = parts[0] * 1;
        var minutes = parts[1] * 1;
        
        offset = modifier * ((hours * 60) + minutes);
      }
    }

    if (offset) {
      date.setTimezoneOffset(offset, abbr);
    }

    for (i; i < l; i += 1) {
      cur = format.charAt(i);
      if (dateFormatter.hasOwnProperty(cur)) {
        out += dateFormatter[cur](date, offset, abbr);
      } else {
        out += cur;
      }
    }

    return out;
  };

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
  swig.setFilter('date', date);
};