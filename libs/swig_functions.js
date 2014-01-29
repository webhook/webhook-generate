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

  this.paginate = false;
  this.curPage = 1;
  this.maxPage = -1;
  this.pageUrl = 'page-';
  this.cachedData = {};

  this.setData = function(data) {
    self.data = data;
  };

  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    if(self.cachedData[names.join(',')])
    {
      return self.cachedData[names.join(',')];
    }

    var data = {};
    names.forEach(function(name) {
      var tempData = self.data[name] || {};
      data = utils.extend(data, tempData);
      data = _.omit(data, function(value, key) { return key.indexOf('_') === 0; });
    });

    self.cachedData[names.join(',')] = data;

    return data;
  };

  var paginate = function(data, perPage, pageName) {
    if(self.curPage === 1 && self.paginate === true)
    {
      throw new Error('Can only paginate one set of data in a template.');
    }

    var items = utils.slice(data, perPage, perPage * (self.curPage-1));
    self.paginate = true;

    self.pageUrl = pageName || self.pageUrl;
    self.maxPage = Math.floor(_(data).size() / perPage);

    return items;
  };

  var getCurPage = function() {
    return self.curPage;
  };

  var getMaxPage = function() {
    return self.maxPage;
  };

  // FUNCTIONS USED FOR PAGINATION HELPING, IGNORE FOR MOST CASES
  this.shouldPaginate = function() {
    return self.curPage <= self.maxPage;
  };

  // Reset initial data
  this.init = function() {
    self.paginate = false;
    self.curPage = 1;
    self.pageUrl = 'page-'
    self.maxPage = -1;
  };

  this.increasePage = function() {
    self.curPage = self.curPage + 1;
  };

  this.getFunctions = function() {
    return {
      get: getCombined,
      paginate: paginate,
      getCurPage: getCurPage,
      getMaxPage: getMaxPage
    };
  };

  return this;
};