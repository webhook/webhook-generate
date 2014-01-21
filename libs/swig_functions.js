'use strict';

var utils = require('./utils.js');
var _ = require('lodash');

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};

  this.shouldPaginate = false;
  this.curPage = 1;
  this.endPagination = false;
  this.pageUrl = 'page-';

  this.setData = function(data) {
    self.data = data;
  };

  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    var data = {};
    names.forEach(function(name) {
      data = utils.extend(data, self.data[name] || {});
      data = _.omit(data, function(value, key) { return key.indexOf('_') === 0; });
    });

    return data;
  };

  var paginate = function(data, perPage, pageName) {
    if(self.curPage === 1 && self.shouldPaginate === true)
    {
      throw new Error('Can only paginate one set of data in a template.');
    }

    var items = utils.slice(data, perPage, perPage * (self.curPage-1));
    self.shouldPaginate = true;

    self.pageUrl = pageName || self.pageUrl;

    if(self.curPage > 1 && _(items).size() === 0)
    {
      self.endPagination = true;
    }

    return items;
  };

  // Reset initial data
  this.init = function() {
    self.shouldPaginate = false;
    self.curPage = 1;
    self.endPagination = false;
    self.pageUrl = 'page-'
  };

  this.increasePage = function() {
    self.curPage = self.curPage + 1;
  };

  this.getFunctions = function() {
    return {
      get: getCombined,
      paginate: paginate
    };
  };

  return this;
};