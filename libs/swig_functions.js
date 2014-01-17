'use strict';

var utils = require('./utils.js');

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};

  this.setData = function(data) {
    self.data = data;
  };

  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    var data = {};
    names.forEach(function(name) {
      data = utils.extend(data, self.data[name] || {});
    });

    return data;
  };

  this.getFunctions = function() {
    return {
      get: getCombined,
    };
  };

  return this;
};