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
  this.typeInfo = {};

  this.setData = function(data) {
    self.data = data;
  };

  this.setTypeInfo = function(typeInfo) {
    self.typeInfo = typeInfo;
  };

  var getTypes = function() {
    var types = [];

    for(var key in self.typeInfo) {
      if(!self.typeInfo[key].oneOff) {
        types.push({ slug: key, name: self.typeInfo[key].name });
      }
    }

    return types;
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

      if(typeof tempData !== 'object') {
        data = tempData;
        return;
      }
      
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
    self.maxPage = Math.ceil(_(data).size() / perPage);

    return items;
  };

  var getCurPage = function() {
    return self.curPage;
  };

  var getMaxPage = function() {
    return self.maxPage;
  };

  var getPaginatedPrefix = function() {
    var prefix = './';

    if(self.curPage > 1) {
      prefix = '../';
    }

    return prefix;
  };

  var getPageUrl = function(pageNum) {

    if(pageNum === 1)
    {
      if(self.curPage === 1) {
        return '.';
      } else {
        return '../';
      }
    }

    var prefix = self.pageUrl + '/';

    if(self.curPage > 1) {
      prefix = '../' + self.pageUrl + '/';
    }

    return prefix + pageNum;
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
      getTypes: getTypes,
      paginate: paginate,
      getCurPage: getCurPage,
      getMaxPage: getMaxPage,
      getPageUrl: getPageUrl,
      getPaginatedPrefix: getPaginatedPrefix
    };
  };

  return this;
};